"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCached = getCached;
exports.setCached = setCached;
exports.delCached = delCached;
const node_cache_1 = __importDefault(require("node-cache"));
const cache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL
function getCached(key) {
    return cache.get(key);
}
function setCached(key, value, ttl) {
    if (ttl !== undefined) {
        cache.set(key, value, ttl);
    }
    else {
        cache.set(key, value);
    }
}
function delCached(key) {
    cache.del(key);
}
exports.default = cache;
