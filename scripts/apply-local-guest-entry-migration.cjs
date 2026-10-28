/* eslint-disable @typescript-eslint/no-require-imports -- guarded local-only schema migration */
// Applies only the additive guest-entry migration, never other pending migrations.
require("dotenv").config({quiet:true});
const {Client}=require("pg");
const {readFileSync}=require("node:fs");
const {spawnSync}=require("node:child_process");
const migration="20261027140000_guest_entry_pass_retrieval";
const url=new URL(process.env.DATABASE_URL || "postgresql://invalid");
if(process.env.NODE_ENV==="production" || !["postgres:","postgresql:"].includes(url.protocol) || !["localhost","127.0.0.1","[::1]"].includes(url.hostname) || url.pathname!=="/kadiyangu")throw new Error("This helper only permits the local development kadiyangu database.");
(async()=>{
 const db=new Client({connectionString:url.href,connectionTimeoutMillis:5000});await db.connect();
 let recorded=false;
 try{
  const columns=await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='GuestPass' AND column_name IN ('guestId','guestSlot','tokenEnvelope')");
  const history=await db.query('SELECT 1 FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL',[migration]);
  recorded=history.rowCount>0;
  if(columns.rowCount===0){
   await db.query("BEGIN");
   try{await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='30s'");await db.query(readFileSync(`prisma/migrations/${migration}/migration.sql`,"utf8"));await db.query("COMMIT");}catch(error){await db.query("ROLLBACK");throw error;}
  }else if(columns.rowCount!==3)throw new Error("Partial guest-entry schema requires manual review; no reset attempted.");
 }finally{await db.end();}
 if(!recorded){const result=spawnSync("npx",["prisma","migrate","resolve","--applied",migration],{stdio:"inherit",env:process.env});process.exitCode=result.status ?? 1;}
 else console.log("Guest-entry local migration already applied. No other migration was changed.");
})().catch(()=>{console.error("Local guest-entry migration could not complete. No reset or production action was performed.");process.exitCode=1;});
