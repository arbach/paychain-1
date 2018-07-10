/* eslint-env mocha */

import request from 'supertest-as-promised';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';
import db from '../../../config/sequelize';
import app from '../../../index';
import BN from 'bn.js';
import { getAllAccounts, web3 } from '../../lib/web3';

const jsonAccounts = require('../../json/accounts.json');
const Token = require('../../../build/contracts/TestERC20.json');

chai.config.includeStack = true;

let accounts = [];
const apiAccounts = [];
const all_transactions = [];
let tokenOwner;
let tokenContract;
let totalSupply = 0;
/**
 * root level hooks
 */
before(() => {
    db.sequelize.sync();
});

describe('## Transaction stress tests', () => {
    describe('# Deploy token and balance transfer', () => {
        before((done) => {
            done();
        });

        after((done) => {
            db.Currency.findOne({
                where: {
                    symbol: 'DC',
                }
            })
            .then((currency) => {
                if (currency) {
                    return currency.updateAttributes({
                        address: tokenContract._address,
                    })
                    .then(() => {
                        done();
                    })
                    .catch(done)
                } else {
                    db.Currency.create({
                        symbol: 'DC',
                        address: tokenContract._address,
                        full_name: 'Dummy Coin',
                        short_name: 'Dummy',
                    })
                    .then(() => {
                        done()
                    })
                    .catch(done)
                }
            })
        });

        it('fetch all accounts', (done) => {
            getAllAccounts().then((_accounts) => {
                accounts = _accounts;
                done();
            });
        });

        it('deploy token', (done) => {
            tokenOwner = accounts[0];
            const ContractAbi = new web3.eth.Contract(Token.abi);
            ContractAbi
                .deploy({ data: Token.bytecode })
                .send({
                    from: tokenOwner,
                    gas: 1500000,
                    gasPrice: '3000000000',
                })
                .then((result) => {
                    tokenContract = result;
                    return tokenContract
                              .methods
                              .balanceOf(tokenOwner)
                              .call({ from: tokenOwner });
                }).then((result) => {
                    totalSupply = new BN(result);
                })
                .then(() => {
                    for (let i = 1; i < accounts.length; i++) {
                        tokenContract.methods.transfer(accounts[i], totalSupply.div(new BN(10))).send({
                            from: tokenOwner
                        }).then(() => {
                            
                        })
                    }
                    done();
                })
        });
    });


    describe('# Create api accounts', () => {
        after((done) => {
            done();
            // startLoadTesting(done);
        });

        for (let i = 0; i < jsonAccounts.length; i += 1) {
            const account = {
                balance: 0,
                address: jsonAccounts[i].address,
                privateKey: jsonAccounts[i].privateKey,
            };

            it('should create 10 api accounts', (done) => {
                db.Account.create(account)
                    .then((res) => {
                        apiAccounts.push(res.body);
                        done();
                    })
                    .catch(done);
            });
        }
    });
});

// function startLoadTesting(done){
//     const options = {
//         url: 'http://localhost:4000/api/transactions',
//         maxRequests: 1,
//         concurrency: 1,
//         method: 'POST',
//         requestsPerSecond: 1,
//         headers: {
//             'content-type': 'application/json'
//         },
//         contentType: 'application/json',
//         body: {
//             amount: 100,
//             to: 2,
//             from: 1,
//             currency_id: 1,
//         }
//     };

//     loadtest.loadTest(options, function(error, result)
//     {
//         if (error)
//         {
//             return console.error('Got an error: %s', error);
//         }
//         console.log('Tests run successfully');
//         done();
//     });
// }

function getRandom (minimum, maximum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
};

function sendTransactionRequests(size = 100) {
    let transactions = [];

    for (let i = 0 ; i < size ; i++ ) {
        const transaction = {
            amount: 100,
            to: getRandom(1,10),
            from: getRandom(1,10),
            currency_id: 1,
        };

        transactions.push(transaction);
    }

    const promises = [];
    // it('should create transactions in bulk', (done) => {

        transactions.map((transaction) => {
            it('should create a transaction', (done) => {
                request(app)
                    .post('/api/transactions')
                    .send(transaction)
                    .expect(httpStatus.OK)
                    .then((res) => {
                        expect(res.body.amount).to.equal(transaction.amount);
                        expect(res.body.to).to.equal(transaction.to);
                        expect(res.body.from).to.equal(transaction.from);
                        expect(res.body.status).to.equal('initiated');

                        // const p = waitForTransactionConfirmation(res.body);
                        // promises.push(p);

                        // if (promises.length >= transactions.length) {
                        //     Promise.all(promises).then((res) => {
                        //         done();
                        //     }).catch(done)
                        // }
                        done();
                    })
                    .catch(done);
            });
        });
    // });
};

function sendBulkTransactionRequests(size = 100) {
    let transactions = [];

    for (let i = 0 ; i < size ; i++ ) {
        const transaction = {
            amount: 100,
            to: getRandom(1,10),
            from: getRandom(1,10),
            currency_id: 1,
        };

        transactions.push(transaction);
    }

    const promises = [];
    it('should create transactions in bulk', (done) => {

        transactions.map((transaction) => {
            request(app)
                .post('/api/transactions')
                .send(transaction)
                .expect(httpStatus.OK)
                .then((res) => {
                    expect(res.body.amount).to.equal(transaction.amount);
                    expect(res.body.to).to.equal(transaction.to);
                    expect(res.body.from).to.equal(transaction.from);
                    expect(res.body.status).to.equal('initiated');

                    const p = waitForTransactionConfirmation(res.body, transactions.length);
                    promises.push(p);

                    if (promises.length >= transactions.length) {
                        Promise.all(promises).then((res) => {
                            done();
                        }).catch(done)
                    }
                })
                .catch(done);
        });
    });
};

function waitForTransactionConfirmation(transaction, length) {        
    return new Promise((fulfill, reject) => {
        setTimeout(() => {
            db.Transaction.findOne({
                where: {
                    id: transaction.id
                }
            })
            .then((res) => {
                expect(res.status).to.be.oneOf(['pending','completed']);
                fulfill();
            })
            .catch(reject);
        }, length * 200);
    });
};

describe('## Transaction APIs', () => {
    after(() => {
        // db.Transaction.drop();
    });

    describe('# POST /api/transactions', () => {
        // sendTransactionRequests(10);
        sendBulkTransactionRequests(100);
    });
});