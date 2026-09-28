import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireTeacher } from "@/lib/authorization";
import { localAssetManagerConfigured, prepareStickerAsset } from "@/lib/local-asset-manager";

export const runtime="nodejs";
export async function POST(request:Request){
  if(!localAssetManagerConfigured())return new NextResponse(null,{status:404});
  try{await requireTeacher();if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({message:"Origem inválida."},{status:403});const entry=await prepareStickerAsset(await request.formData());return NextResponse.json({entry},{status:201})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Revise os metadados e as confirmações."},{status:400});const known:Record<string,string>={INVALID_FILE_SIZE:"A imagem deve ter no máximo 10 MB.",INVALID_IMAGE_FORMAT:"Use JPEG, PNG ou WebP estático.",ANIMATED_IMAGE:"Imagens animadas não são aceitas.",INVALID_IMAGE_DIMENSIONS:"A imagem deve ter no máximo 4.096 × 4.096 pixels.",INVALID_SLUG:"Use slugs seguros de 3 a 40 caracteres.",DUPLICATE_SLUG:"Esse slug já existe e não pode ser sobrescrito.",DUPLICATE_NUMBER:"Esse número já existe na coleção.",DUPLICATE_IMAGE:"Essa imagem já está no catálogo.",ASSET_MANAGER_BUSY:"Outra preparação está em andamento."};const message=error instanceof Error?known[error.message]:null;return NextResponse.json({message:message??"Não foi possível preparar a figurinha."},{status:message?409:500})}
}
