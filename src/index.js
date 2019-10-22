import { configure, observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';
import React, { Component, useState } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import { merge } from 'lodash'
import PapaParse from 'papaparse'

import * as serviceWorker from './serviceWorker';

configure({ enforceActions: "observed" });


function* next_day_ua_generator(initial = 0) {
    if (initial < 0 || initial > 6)
        throw Error(`The UA day must have initial value in 0-6 not ${initial}`);
    while (true) {
        initial = (initial > 6) ? 0 : initial;
        yield initial;
        initial++;
    }
}

class Store {
    DAY_NIGHT_MS = 3600 * 24 * 1000;
    WEEK_MS = this.DAY_NIGHT_MS * 6;
    DAYS_NAME = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    date2str = (dt) => {
        //console.log("dt=", dt);
        return (new Date(dt)).toISOString().slice(0, 10);
    }
    @observable today = new Date();
    @observable first_date_str = this.date2str(this.today);
    @observable last_date_str = this.date2str(new Date(this.today.getTime() + this.WEEK_MS));
    @observable row_names = [
        { name: "1+1 SDI main serv", url_name: "1plus1/analog/main/1plus1.analog" },
        { name: "1+1 SDI back serv", url_name: "1plus1/analog/backup/1plus1.analog" },
        { name: "1+1 SDI main titl", url_name: "1plus1/plashka/main/1plus1.kyiv-sdi" },
        { name: "1+1 SDI back titl", url_name: "1plus1/plashka/backup/1plus1.kyiv-sdi" },
        { name: "2+2 SDI main serv", url_name: "2plus2/analog/main/twoplustwo.analog" },
        { name: "2+2 SDI back serv", url_name: "2plus2/analog/backup/twoplustwo.analog" },
        { name: "2+2 SDI main titl", url_name: "2plus2/plashka/main/2plus2.kyiv-sdi" },
        { name: "2+2 SDI back titl", url_name: "2plus2/plashka/backup/2plus2.kyiv-sdi" },
        { name: "TET SDI main titl", url_name: "TET/plashka/main/TET.kyiv-sdi" },
        { name: "TET SDI back titl", url_name: "TET/plashka/backup/TET.kyiv-sdi" },
    ];

    @observable log = { protocol: "ftp", server: "server", user: "user", password: "password", folder: "folder" };

    @computed get first_date() { return new Date(this.first_date_str); }
    @computed get last_date() { return new Date(this.last_date_str); }
    @computed get date_range_str() {
        let arr = [];
        const first_time_ms = this.first_date.getTime();
        const last_time_ms = this.last_date.getTime();
        const week_day_en = this.first_date.getDay();
        const day_ua = (week_day_en === 0) ? 6 : week_day_en - 1;
        const week_day_ua = next_day_ua_generator(day_ua);
        //console.log("time_range", first_time_ms, last_time_ms);
        for (let i = first_time_ms,
            week_idx = week_day_ua.next().value;
            i <= last_time_ms;
            i += this.DAY_NIGHT_MS,
            week_idx = week_day_ua.next().value) {
            arr.push({ day: this.DAYS_NAME[week_idx], date: this.date2str(i) });
        }
        return arr;
    }

    @action setFirstDate = (first_date_str) => {
        this.first_date_str = first_date_str;
        const first_date = Date.parse(this.first_date_str);
        //console.log(first_date, first_date_str);

        if (first_date > Date.parse(this.last_date_str)) {
            this.setLastDate(this.date2str(first_date + this.WEEK_MS));
            //console.log("LD", this.last_date_str);
        }
    }

    @action setLastDate = (last_date_str) => {
        this.last_date_str = last_date_str;
        const last_date = Date.parse(this.last_date_str);

        if (Date.parse(this.first_date_str) > last_date)
            this.setFirstDate(this.date2str(last_date - this.WEEK_MS));
        //console.log(this.date_range_str);
    }

    @action setLogParametr = (obj) => merge(this.log, obj);
    // @action setPathParametr = (obj) => merge(this.row_names, obj);
    @action setStore = (obj) => merge(this, obj);
    @action setRowName = (name, url_name) => { this.row_names.push({ name, url_name }) };
    @action popRowName = () => { this.row_names.pop() };

}


const appStore = new Store();
//console.log(appStore.count);



function isVerFile(text) {
    const start = "REM expected   |window   |   |sch|      |real values"
    return text.indexOf(start) === 0;
}

const fetchContent = async (url) => {
    try {
        let response = await fetch(url);
        let text = await response.text();
        return text;
    } catch (error) {
        console.log("Something's wrong", error);
        return "";
    }
}

var config_obj = {
    delimiter: "\t",// auto-detect
    newline: "",	// auto-detect
    header: false,
    dynamicTyping: false,
    preview: 0,
    encoding: "",
    worker: false,
    comments: "REM",
    step: undefined,
    complete: undefined,
    error: undefined,
    download: false,
    skipEmptyLines: true,//changed
    chunk: undefined,
    fastMode: undefined
};

function findEWOk(papaCSVresult, code_column = 13 - 1) {
    const error_codes = [
        "2002",//выход по плейлисту есть, но неизвестен код ролика (невозможно считать из плейлиста, непроинициализирован и т.д.)
        "0020",//видеоролик не найден на диске
        "0006",//видеоролик есть на диске, но он битый и/или некорректный
        "1014",//"блок динамически исключён из расписания пользователем или внешней командой". Выставляется для всех роликов в блоке.
        "0008", //выход блока прерван пользователем. Выставляется для частично и полностью невышедших роликов.
        "0012", //во время выхода ролика возникла внутренняя ошибка выдачи". Только для конкретного ролика.
        "1013", //выход блока прерван по лимиту времени на блок, указанном в расписании". Выставляется для частично и полностью невышедших роликов.
        "0023"  //"все ролики блока не вышли, потому что не было стартовой метки". Выставляется для всех роликов в блоке.
    ];
    const warning_codes = [
        "0000", //ещё не выходил в эфир
        "1000", //ещё не выходил в эфир, но уже на подготовке (подгружен)
        "0013"  //выход блока прерван по закрывающией метке". Выставляется для частично и полностью невышедших роликов.
    ];
    const ok_codes = [
        "0001",// ролик полностью и корректно вышел в эфир6
        "1001", // прямо сейчас выходит в эфир. !!!! Пока у Аврутина глючит
    ];
    const event_codes = papaCSVresult.data.filter(row => row.indexOf("END") === -1).map(row => row[code_column]);

    for (let i = 0; i < event_codes.length; i++) {
        let code = event_codes[i];
        if (error_codes.indexOf(code) !== -1)
            return "ERROR";
        if (warning_codes.indexOf(code) !== -1)
            return "WARNING";
        if (ok_codes.indexOf(code) !== -1) {
            // console.log("ssssssss")
            return "OK";
        }
        console.log("UNKNOWN CODE", code, "code_column", code_column, papaCSVresult.data);
    }
    console.log(event_codes);
    return "UNKNOWN CODE";
}

class Link extends Component {
    constructor(props) {
        super(props);

        this.state = { linkClass: "no-file-link", content: "", csvResult: {} };
        fetchContent(this.props.url).then(text => {
            const csv_text = text.replace(/[^A-Za-z0-9_|\r\n]+/g, "\t");

            if (isVerFile(text)) {
                const papaCSVresult = PapaParse.parse(csv_text, config_obj);
                const error_warrning_ok = findEWOk(papaCSVresult);
                switch (error_warrning_ok) {
                    case "ERROR":
                        this.setState({ linkClass: "error-file-link" });
                        break;
                    case "WARNING":
                        this.setState({ linkClass: "warning-file-link" });
                        break;
                    case "OK":
                        this.setState({ linkClass: "ok-file-link" });
                        break;
                    case "UNKNOWN CODE":
                        this.setState({ linkClass: "exist-file-link" });
                        break;
                    default:
                        console.log("unknow result of find error warning or ok function");
                }
                this.setState({ content: text });
            }
        }
        )
    }

    render() {
        return (<div>
            <a
                href={this.props.url}
                title={this.state.content}
                className={this.state.linkClass}
            >
                {this.props.name}

            </a >
        </div>);
    }
}

function Name(props) {
    const [name, setName] = useState(props.name);
    const { store, index } = props;

    return (
        <div>
            <input type="text" value={name}
                onChange={(e) => {
                    const new_server_name = e.target.value;
                    setName(new_server_name);
                    store.setRowName(index, new_server_name);
                    localStorage.setItem("store", JSON.stringify(store));
                }}
            />
        </div>
    );
}

class LinkTable extends Component {
    render() {
        const store = this.props.store;
        const header_items = store.date_range_str.map((str, idx) => <div key={idx}>
            <div>{str.date.slice(5).replace(/-/g, ".")}</div>
            <div>{str.day}</div>
        </div>);
        return <div>
            <table>
                <thead>
                    <tr>
                        <th>Name/Date</th>{header_items.map((link, i) => <th key={i}>{link}</th>)}
                        {/* <th>Path</th> */}
                    </tr>
                </thead>
                <tbody>
                    {store.row_names.map((row, idx) => {
                        return <tr key={idx}>
                            <td><Name name={row.name} store={appStore} index={idx} /></td>
                            {store.date_range_str.map((str) => {
                                const { server, user, password, folder, protocol } = store.log;
                                // const log_url = process.env.PUBLIC_URL + `/${folder}/${row.url_name}.${str.date.replace(/-/g, ".")}.ver`;
                                const log_url = (user !== "" && password !== "") ?
                                    `${protocol}://${user}:${password}@${server}/${folder}/${row.url_name}.${str.date.replace(/-/g, ".")}.ver`
                                    :
                                    `${protocol}://${server}/${folder}/${row.url_name}.${str.date.replace(/-/g, ".")}.ver`;
                                return (
                                    <td key={log_url}>
                                        <Link
                                            name={str.date.slice(5).replace(/-/g, ".")}
                                            url={log_url}
                                        />
                                    </td>);
                            }
                            )}
                        </tr>
                    })}

                </tbody>
            </table>
            <button
                onClick={() => {
                    const name = prompt("Name of server");
                    const log_path = prompt("Path to log files");
                    store.setRowName(name, log_path);
                    this.forceUpdate();
                    localStorage.setItem("store", JSON.stringify(store));

                }}
            >+</button>
            <button
                onClick={() => {
                    store.popRowName();
                    this.forceUpdate();
                    localStorage.setItem("store", JSON.stringify(store));
                }}
            >-</button>
        </div>
    }
}

@observer class App extends Component {
    constructor(props) {
        super(props);
        const local_store = JSON.parse(localStorage.getItem("store"));
        props.store.setStore(local_store);
    }

    changeLogServerParameters = (e) => {
        const { store } = this.props;
        store.setLogParametr({ [e.target.name]: e.target.value });
        localStorage.setItem("store", JSON.stringify(store));
    }

    changeDate = (e) => {
        const { store } = this.props;
        switch (e.target.name) {
            case "first_date_str":
                store.setFirstDate(e.target.value);
                break;
            case "last_date_str":
                store.setLastDate(e.target.value);
                break;
        }
        localStorage.setItem("store", JSON.stringify(store));
    }

    render() {
        const { store } = this.props;
        //console.log(store.getUser);

        return (
            <div className="App">
                <input name='protocol' type="text" onChange={this.changeLogServerParameters} value={store.log.protocol} />
                ://
                <input name='user' type="text" onChange={this.changeLogServerParameters} value={store.log.user} />
                :
                <input name='password' type="password" onChange={this.changeLogServerParameters} value={store.log.password} />
                @
                <input name='server' type="text" onChange={this.changeLogServerParameters} value={store.log.server} />
                /
                <input name='folder' type="text" onChange={this.changeLogServerParameters} value={store.log.folder} />
                <br />
                <input name="first_date_str" type="date" onChange={this.changeDate} value={store.first_date_str} />
                <input name="last_date_str" type="date" onChange={this.changeDate} value={store.last_date_str} />
                <LinkTable store={store} />
                <img src={process.env.PUBLIC_URL + '/img/brovar.jpg'} />
            </div>
        );
    }
}

ReactDOM.render(<App store={appStore} />, document.getElementById('root'));

serviceWorker.unregister();
