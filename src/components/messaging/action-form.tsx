"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
export function actionFeedback(state:{ok:boolean;error?:string;success?:string}){return state.ok?{role:"status" as const,message:state.success||"Saved"}:{role:"alert" as const,message:state.error||"Unable to complete this action"};}
export function submitLabel(pending:boolean,label:string){return pending?"Saving…":label;}
function Submit({label}:{label:string}){const {pending}=useFormStatus();return <button disabled={pending} aria-disabled={pending} className="rounded-full bg-rose-gold px-4 py-2 text-white disabled:opacity-50">{submitLabel(pending,label)}</button>}
export function MessagingActionForm({action,children,label}:{action:(state:{ok:boolean;error?:string;success?:string},form:FormData)=>Promise<{ok:boolean;error?:string;success?:string}>;children:React.ReactNode;label:string}){const [state,formAction]=useActionState(action,{ok:false});const feedback=actionFeedback(state);return <form action={formAction} className="grid gap-2">{children}<Submit label={label}/><p role={feedback.role} className={state.ok?"text-sm text-green-700":"text-sm text-red-700"}>{state.ok&&state.success?feedback.message:state.error?feedback.message:null}</p></form>}
