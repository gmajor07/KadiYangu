/* eslint-disable @typescript-eslint/no-require-imports -- isolated test provisioning */
// Creates an isolated, empty database only. Never resets or drops any database.
require("dotenv").config({quiet:true});
const {Client}=require("pg");
const {spawnSync}=require("node:child_process");
const url=new URL(process.env.DATABASE_URL || "postgresql://invalid");
if(!["postgres:","postgresql:"].includes(url.protocol)||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Local PostgreSQL required.");
url.pathname="/postgres";
(async()=>{
 const admin=new Client({connectionString:url.href});await admin.connect();
 try{const exists=await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",["kadiyangu_scanner_test"]);if(!exists.rowCount)await admin.query('CREATE DATABASE "kadiyangu_scanner_test"');}finally{await admin.end();}
 url.pathname="/kadiyangu_scanner_test";
 const db=new Client({connectionString:url.href});await db.connect();
 let count;try{count=await db.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");}finally{await db.end();}
 if(count.rows[0].count!==0){console.log("Scanner test database already has tables. No schema changes attempted; use the existing isolated schema.");return;}
 const result=spawnSync("npx",["prisma","db","push","--skip-generate"],{stdio:"inherit",env:{...process.env,DATABASE_URL:url.href}});
 process.exitCode=result.status ?? 1;
})().catch(()=>{console.error("Isolated scanner database preparation failed. No database was reset.");process.exitCode=1;});
