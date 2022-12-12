const dateFormat =  require('date-and-time');
const { ConnectionPool } = require('mssql');
let pools = {};

// create a new connection pool
const createPool = (config, name) => {
  let key = name ? name: JSON.stringify(config);

  if (checkPool(key)) throw new Error('Pool already exists');

  pools[key] = new ConnectionPool(config);
  return pools[key];
}

// get a connection pool from all pools
const checkPool = (name) => {
  if (pools[name]) {
    return pools[name];
  }

  return null;
}

// if pool already exists, return it, otherwise create it
const getPool = (config, name) => {
  let key = name ? name: JSON.stringify(config);
  let pool = checkPool(key);

  if (pool) {
    return pool;
  }

  return createPool(config, name);
}

// close a single pool
const closePool = (config, name) => {
  let key = name ? name: JSON.stringify(config);

  if (pools[key]) {
    const pool = pools[key];
    delete pools[key];

    pool.close();
    return true;
  }

  return false;
}

// close all the pools
const closeAllPools = () => {
  pools.forEach((pool) => {
    pool.close();
  });

  pools = {};

  return true;
}

const createConnName = (prefix = '') => {
  let now = new Date();
  let dateString = dateFormat.format(now, 'YYYYMMDDHHmmssSSS');
  return prefix + dateString;
} 

module.exports = {
  closePool,
  closeAllPools,
  createPool,
  checkPool,
  getPool,
  createConnName,
};
