import { SignJWT, jwtVerify } from "jose";
export const SESSION_COOKIE = "sala-maker-session";
export type SessionPayload = { userId:string; role:"TEACHER"|"STUDENT"; version:number; mustChangePassword:boolean };
function key(){const value=process.env.AUTH_SECRET;if(!value||value.length<32)throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.");return new TextEncoder().encode(value)}
export const sessionMaxAge=(role:SessionPayload["role"])=>role==="STUDENT"?60*30:60*60*24*30;
export async function createSessionToken(payload:SessionPayload){return new SignJWT(payload).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime(payload.role==="STUDENT"?"30m":"30d").sign(key())}
export async function readSessionToken(token:string){const {payload}=await jwtVerify(token,key());return payload as unknown as SessionPayload}
