import request from 'supertest-as-promised';
import db from '../../config/sequelize';
import app from '../../index';
import config from '../../config/config';
import defaults from '../json/defaults.json';
import { isLocalNode } from '../helpers/helpers';
import Token from '../../../build/contracts/TestERC20.json';
import { getAllAccounts, web3 } from '../lib/web3';

const tokenContract = {};
const apiAccounts = [];

const clearDB = () => {
    console.log('Clearing DB...');
    return new Promise((resolve, reject) => {
        db.sequelize
            .query("SET FOREIGN_KEY_CHECKS=0")
            .then(() => {
                return db.sequelize.sync({ force: true });
            })
            .then(() => {
                return db.sequelize
                    .query("SET FOREIGN_KEY_CHECKS=1")
            })
            .then(resolve)
            .catch(reject);

    });
};

const createAccounts = () => {
    console.log('Creating accounts...');
    return new Promise((resolve, reject) => {
        const promises = [];
        for (let i = 0; i < defaults.accounts.length; i += 1) {
            const account = {
                address: defaults.accounts[i].address,
                privateKey: defaults.accounts[i].privateKey,
            };

            const promise = new Promise((resolve, reject) => {
                request(app)
                    .post('/api/accounts')
                    .send(account)
                    .then((res) => {
                        apiAccounts.push(res.body);
                        resolve(res.body);
                    })
                    .catch(reject);
            });
            promises.push(promise);
        }

        Promise.all(promises).then(() => {
            console.log(`Created ${apiAccounts.length} accounts`);
            resolve(apiAccounts);
        })
        .catch(error => {
          reject(error);
        });
    });
};

const createDefaultCurrency = (address) => {
    console.log('Setting default currency...');
    return new Promise((resolve, reject) => {
        const currency = {
            query: {
                symbol: 'DC',
            },
            update: {
                address: address,
                full_name: 'Dummy Coin',
                short_name: 'Dummy',
            }
        };
        request(app)
            .post(`/api/currency/upsert`)
            .send(currency)
            .then((res) => {
                resolve(res.body)
            })
            .catch(reject);
    });
};

// Create and deploy token
// Should only be called if we are deploying on testrpc. Otherwise, token should be already deployed
// and used each time.

const deployToken = () => {
    console.log('Deploying token...');
    return new Promise(async (resolve, reject) => {
        const tokenOwner = defaults.accounts[0];

        let tokenContract = {};
        const ContractAbi = new web3.eth.Contract(Token.abi);
        ContractAbi
            .deploy({ data: Token.bytecode })
            .send({
                from: tokenOwner.address,
                gas: 1500000,
                gasPrice: '3000000000',
            })
            .then((tokenContract) => {
                return createDefaultCurrency(tokenContract._address);
            })
            .then((defaultCurrency) => {
                resolve(tokenContract);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

const initLocal = async () => {
    try {
        await clearDB();
        await deployToken();
        await createAccounts();
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
};

const initProd = async () => {
    try {
        await createDefaultCurrency(config.web3.contract_address || defaults.token_address);
        await createAccounts();
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
};

if (isLocalNode(config.web3.provider_url)) {
    initLocal();
} else {
    initProd();
};
