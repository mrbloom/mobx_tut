import { decorate, configure, observable, computed, extendObservable, action, runInAction, when, autorun } from 'mobx';
import { observer } from 'mobx-react';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import * as serviceWorker from './serviceWorker';

configure({ enforceActions: "observed" });


class Store {
    DAY_NIGHT_MS = 3600 * 24 * 1000;
    WEEK_MS = this.DAY_NIGHT_MS * 6;
    date2str = (dt) => {
        console.log("dt=", dt);
        return (new Date(dt)).toISOString().slice(0, 10);
    }
    today = new Date();
    @observable count = 0;
    @observable first_date_str = this.date2str(this.today);
    @observable last_date_str = this.date2str(new Date(this.today.getTime() + this.WEEK_MS));

    @computed get first_date() { return new Date(this.first_date_str); }
    @computed get last_date() { return new Date(this.last_date_str); }
    @computed get date_range_str() {
        let arr = [];
        const first_time_ms = this.first_date.getTime();
        const last_time_ms = this.last_date.getTime();
        console.log("time_range", first_time_ms, last_time_ms);
        for (let i = first_time_ms; i <= last_time_ms; i += this.DAY_NIGHT_MS) {
            arr.push(this.date2str(i))
            console.log(this.date2str(i));
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
    return <a href={props.url}>{props.name}</a>;
}

@observer class App extends Component {
    render() {
        const { store } = this.props;
        console.log(store.getUser);

        return (
            <div className="App">
                <button onClick={store.getUser}>Get user</button>
                <h1>{store.user ? store.user.login.username : "default user"}</h1>
                <button onClick={store.increment}>+</button><button onClick={store.decrement}>-</button>
                <h1>{store.count}</h1>
                <input type="date" onChange={(e) => store.setFirstDate(e.target.value)} value={store.first_date_str} />
                <input type="date" onChange={(e) => store.setLastDate(e.target.value)} value={store.last_date_str} />
                <ul>
                    {store.date_range_str.map((str) => <li key={str}><Link name={str} url={str} /></li>)}
                </ul>
            </div >
        );
    }
}

ReactDOM.render(<App store={appStore} />, document.getElementById('root'));


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
