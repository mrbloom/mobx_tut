import { decorate, configure, observable, computed, action, runInAction, when, autorun } from 'mobx';
import { observer } from 'mobx-react';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import { merge } from 'lodash'

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
        console.log("dt=", dt);
        return (new Date(dt)).toISOString().slice(0, 10);
    }
    today = new Date();
    @observable count = 0;
    @observable first_date_str = this.date2str(this.today);
    @observable last_date_str = this.date2str(new Date(this.today.getTime() + this.WEEK_MS));
    @observable row_names = [
        { name: "1+1 SDI main serv", url_name: "1plus1/main/1plus1.analog" },
        { name: "1+1 SDI back serv", url_name: "1plus1/backup/1plus1.analog" },
        { name: "1+1 SDI main titl", url_name: "1plus1/plashka/main/1plus1.kyiv-sdi" },
        { name: "1+1 SDI back titl", url_name: "1plus1/plashka/backup/1plus1.kyiv-sdi" },
        { name: "2+2 SDI main serv", url_name: "2plus2/main/2plus2.analog" },
        { name: "2+2 SDI back serv", url_name: "2plus2/backup/2plus2.analog" },
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
        console.log("time_range", first_time_ms, last_time_ms);
        for (let i = first_time_ms,
            week_idx = week_day_ua.next().value;
            i <= last_time_ms;
            i += this.DAY_NIGHT_MS,
            week_idx = week_day_ua.next().value) {
            arr.push({ day: this.DAYS_NAME[week_idx], date: this.date2str(i) });
        }
        return arr;
    }


    getUser() {
        console.log("get user func");
        fetch('https://randomuser.me/api/')
            .then(res => res.json())
            .then(json => {
                if (json.results) {
                    runInAction(() => this.user = json.results[0])
                    // this.setUser(json.results[0]);
                }
            })
    }

    @action increment = () => {
        this.count++;
    }

    @action decrement = () => {
        this.count--;
    }

    @action setFirstDate = (first_date_str) => {
        this.first_date_str = first_date_str;
        const first_date = Date.parse(this.first_date_str);
        console.log(first_date, first_date_str);

        if (first_date > Date.parse(this.last_date_str)) {
            this.setLastDate(this.date2str(first_date + this.WEEK_MS));
            console.log("LD", this.last_date_str);
        }
    }

    @action setLastDate = (last_date_str) => {
        this.last_date_str = last_date_str;
        const last_date = Date.parse(this.last_date_str);

        if (Date.parse(this.first_date_str) > last_date)
            this.setFirstDate(this.date2str(last_date - this.WEEK_MS));
        console.log(this.date_range_str);
    }

    @action setLogParametr = (obj) => merge(this.log, obj);
    @action setStore = (obj) => merge(this, obj);
    // @action setLogProtocol = (serv) => this.log_protocol = serv;
    // @action setLogServer = (serv) => this.log_server = serv;
    // @action setLogUser = (serv) => this.log_user = serv;
    // @action setLogPassword = (serv) => this.log_password = serv;
    // @action setLogFolder = (serv) => this.log_folder = serv;
}

decorate(Store, {
    user: observable,
    getUser: action.bound,
    setUser: action,
})

const appStore = new Store();
console.log(appStore.count);

when(
    () => appStore.count > 5,
    () => alert("!!!!>>>>5")
);

autorun(
    () => {
        if (appStore.count > 10)
            alert(`counter=${appStore.count}`);
    },
    {
        name: "Autorun fucntion",
        delay: 3000,
    }
);

function Link(props) {
    return <a href={props.url}>{props.name}<br />{props.name2}</a>;
}

function LinkTable(props) {
    const store = props.store;
    const header_items = store.date_range_str.map((str) => <div>
        <div>{str.date.slice(5).replace(/-/g, ".")}</div> <div>{str.day}</div>
    </div>);
    return <table>
        <thead>
            <tr>
                <th>Name/Date</th>{header_items.map((link, i) => <th key={i}>{link}</th>)}
            </tr>
        </thead>
        <tbody>
            {store.row_names.map((row) => {
                return <tr>
                    <td>{row.name}</td>
                    {store.date_range_str.map((str) => {
                        const { server, user, password, folder, protocol } = store.log;
                        const log_url = `${protocol}://${user}:${password}@${server}/${folder}/${row.url_name}.${str.date.replace(/-/g, ".")}.ver`;
                        return (
                            <td>
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
}

@observer class App extends Component {
    constructor(props) {
        super(props);
        const local_store = JSON.parse(localStorage.getItem("store"));
        console.log(local_store);
        props.store.setStore(local_store);
        // merge(this.props.store, local_store);
        // this.props.store.setLogParametr(local_store);
    }

    changeLogServerParameters = (e) => {
        const { store } = this.props;
        store.setLogParametr({ [e.target.name]: e.target.value });
        localStorage.setItem("store", JSON.stringify(store));
    }

    render() {
        const { store } = this.props;
        console.log(store.getUser);

        return (
            <div className="App">
                <button onClick={store.getUser}>Get user</button>
                <h1>{store.user ? store.user.login.username : "default user"}</h1>
                <button onClick={store.increment}>+</button><button onClick={store.decrement}>-</button>
                <h1>{store.count}</h1>

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
                <input type="date" onChange={(e) => store.setFirstDate(e.target.value)} value={store.first_date_str} />
                <input type="date" onChange={(e) => store.setLastDate(e.target.value)} value={store.last_date_str} />
                <LinkTable store={store} />
                {/* <ul>
                    {store.date_range_str.map((str) => <li key={str.date}><Link name={str.date} url={str.date} /></li>)}
                </ul> */}
            </div >
        );
    }
}

ReactDOM.render(<App store={appStore} />, document.getElementById('root'));


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
