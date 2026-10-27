/* eslint-disable @typescript-eslint/no-require-imports -- isolated test runner */
require("dotenv").config({quiet:true});
const {spawn}=require("node:child_process");
const {randomBytes}=require("node:crypto");
const url=new URL(process.env.DATABASE_URL || "postgresql://invalid");
if(!["postgres:","postgresql:"].includes(url.protocol)||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Scanner tests require loopback PostgreSQL.");
url.pathname="/kadiyangu_scanner_test";
const [command,...args]=process.argv.slice(2);
if(!command)throw new Error("Provide a command.");
const port=process.env.SCANNER_TEST_PORT || "3207";
const child=spawn(command,args,{stdio:"inherit",env:{...process.env,DATABASE_URL:url.href,ALLOW_SCANNER_DB_TESTS:"true",ALLOW_TEST_DATABASE:"true",AUTH_SECRET:randomBytes(48).toString("base64"),NEXTAUTH_URL:`http://localhost:${port}`,NEXT_PUBLIC_APP_URL:`http://localhost:${port}`,SMS_DISPATCH_MODE:"disabled",SMS_MOCK_DISPATCH_ENABLED:"false",ENABLE_TEST_PAYMENTS:"false"}});
child.on("error",()=>{console.error("Could not launch scanner test command.");process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code ?? 1;});
process.on("SIGINT",()=>child.kill("SIGINT"));process.on("SIGTERM",()=>child.kill("SIGTERM"));
