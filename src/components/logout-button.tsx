"use client";import {LogOut} from "lucide-react";
export function LogoutButton({label=false}:{label?:boolean}){return <form action="/api/auth/logout" method="post"><button aria-label="Sair" className="focus-ring flex items-center gap-2 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={18}/>{label&&<span className="text-sm">Sair</span>}</button></form>}
