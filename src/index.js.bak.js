import { decorate, configure, observable, computed, extendObservable, action } from 'mobx';
import { observer } from 'mobx-react';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import * as serviceWorker from './serviceWorker';
import { escapeStrForRegex } from 'jest-regex-util';
import { parse } from 'querystring';

configure({ enforceActions: "observed" });

class Store {
    devList = [
        { name: "Jack", sp: 12 },
        { name: "Max", sp: 10 },
        { name: "Leo", sp: 2 },
    ];

    filter = "";

    get totalSum() {
        const sum = (accum, { sp }) => accum += sp;
        return this.devList.reduce(sum, 0);
    }

    get topPerformer() {
        const maxSP = (({ name: max_nm, sp: max_sp }, { name, sp }) => (sp > max_sp) ? { name, sp } : { name: max_nm, sp: max_sp });
        const maxDevName = (this.devList.length > 0) ? this.devList.reduce(maxSP) : { name: "THIS GM HS NO NM", sp: 0 };
        return maxDevName;
    };

    addDeveloper(dev) {
        this.devList.push(dev);
    }

    get filteredDevelopers() {
        const matchesFilter = new RegExp(this.filter, "i");
        return this.devList.filter(({ name }) => !this.filter || matchesFilter.test(name));
    }

    clearList() {
        this.devList = [];
    }

    updateFilter(value) {
        this.filter = value;
    }
}

decorate(Store, {
    devList: observable,
    filter: observable,
    totalSum: computed,
    topPerformer: computed,
    filteredDevelopers: computed,
    addDeveloper: action,
    clearList: action,
    updateFilter: action,
});

const appStore = new Store();

const Row = ({ data: { name, sp } }) => {
    return (
        <tr>
            <td>{name}</td><td>{sp}</td>
        </tr>
    );
};

@observer class Table extends Component {
    render() {
        const { store } = this.props;
        console.log(store.filteredDevelopers)

        return (
            <table>
                <thead><tr><td>Name</td><td>SP:</td></tr></thead>
                <tbody>
                    {store.filteredDevelopers.map((dev, i) => <Row key={i} data={dev} />)}
                </tbody>
                <tfoot>
                    <tr><td>Team SP</td><td>{store.totalSum}</td></tr>
                    <tr><td>TOP performer</td><td>{store.topPerformer ? store.topPerformer.name : ''}</td></tr>
                </tfoot>
            </table>
        );
    }
}

@observer class Controls extends Component {
    addDeveloper = () => {
        const name = prompt("The name");
        const sp = parseInt(prompt("The story points:"), 10);
        this.props.store.addDeveloper({ name, sp });
    }

    clearList = () => { this.props.store.clearList(); }

    filteredDevelopers = ({ target: { value } }) => {
        this.props.store.updateFilter(value);
    };

    render() {
        return (
            <div className="controls">
                <button onClick={this.clearList}>Clear table</button>
                <button onClick={this.addDeveloper}>Add</button>
                <input value={this.props.store.filter} onChange={this.filteredDevelopers} />
            </div>
        )
    }
}

class App extends Component {
    render() {
        return (
            <div className="App">
                <h1>BORDA</h1>
                <Controls store={appStore} />
                <Table store={appStore} />
            </div>
        );
    }
}

ReactDOM.render(<App store={Store} />, document.getElementById('root'));


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
