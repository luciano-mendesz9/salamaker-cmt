import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StickerAlbum } from "@/components/sticker-album";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { getSchoolDay } from "@/lib/school-day";
import { DAILY_STICKER_PACK_LIMIT } from "@/lib/stickers";
import { releaseExpiredStickerEscrows } from "@/lib/sticker-transactions";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";
import { getStickerMarketEnabled } from "@/lib/sticker-market";

export default async function AlbumPage(){
  const{student}=await requireStudent();
  const readiness=await getCollectiblesReadiness();
  if(!readiness.ready)return <main className="mesh min-h-screen px-4 py-6 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/aluno" className="button-secondary"><ArrowLeft size={17}/>Voltar</Link><section className="glass mt-7 rounded-3xl p-8 text-center"><p className="eyebrow">Implantação pendente</p><h1 className="mt-3 font-display text-3xl font-bold">Álbum temporariamente indisponível</h1><p className="mx-auto mt-3 max-w-xl text-slate-400">A interface já está instalada, mas as tabelas de figurinhas e tesouraria ainda não existem no banco compartilhado. Nenhum saldo ou histórico foi alterado.</p></section></div></main>;
  await releaseExpiredStickerEscrows();
  const marketEnabled=await getStickerMarketEnabled();
  const ownedStickerIds=(await prisma.stickerCopy.findMany({where:{ownerId:student.id},distinct:["stickerId"],select:{stickerId:true}})).map(item=>item.stickerId);
  const[stickers,listings,ownListings,donations,packs,rarityStock,progress]=await Promise.all([
    prisma.sticker.findMany({where:{state:"PUBLISHED"},orderBy:[{collection:{createdAt:"desc"}},{number:"asc"}],select:{id:true,slug:true,number:true,name:true,description:true,alt:true,imagePath:true,totalCopies:true,rarity:true,score:true,collection:{select:{name:true,slug:true}},copies:{where:{ownerId:student.id},select:{id:true,state:true}}}}),
    prisma.stickerListing.findMany({
      where:{state:"ACTIVE",expiresAt:{gt:new Date()},sellerId:{not:student.id},copy:{stickerId:{notIn:ownedStickerIds}},seller:{status:"ACTIVE"}},
      take:50,
      orderBy:{createdAt:"desc"},
      select:{
        id:true,
        price:true,
        expiresAt:true,
        seller:{select:{firstName:true}},
        copy:{select:{sticker:{select:{
          id:true,slug:true,number:true,name:true,description:true,alt:true,imagePath:true,
          totalCopies:true,rarity:true,score:true,collection:{select:{name:true,slug:true}},
        }}}},
      },
    }),
    prisma.stickerListing.findMany({where:{sellerId:student.id,state:"ACTIVE",expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},select:{id:true,price:true,expiresAt:true,copy:{select:{sticker:{select:{name:true}}}}}}),
    prisma.stickerDonation.findMany({where:{recipientId:student.id,state:"PENDING",expiresAt:{gt:new Date()}},select:{id:true,expiresAt:true,sender:{select:{firstName:true}},copy:{select:{sticker:{select:{name:true,imagePath:true,alt:true}}}}}}),
    prisma.stickerPackPurchase.count({where:{studentId:student.id,schoolDay:getSchoolDay().key,price:{gt:0}}}),
    prisma.stickerCopy.groupBy({by:["stickerId"],where:{state:"TREASURY"},_count:{_all:true}}),
    prisma.studentPatentProgress.findUnique({where:{studentId:student.id},include:{level:true}}),
  ]);
  const rarityBySticker=new Map((await prisma.sticker.findMany({where:{id:{in:rarityStock.map(i=>i.stickerId)}},select:{id:true,rarity:true}})).map(s=>[s.id,s.rarity]));
  const treasuryStock:Record<string,number>={LOW:0,MEDIUM:0,HIGH:0};for(const row of rarityStock)treasuryStock[rarityBySticker.get(row.stickerId)??"LOW"]+=row._count._all;
  return <main className="mesh min-h-screen px-4 py-6 sm:px-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex items-center justify-between"><div><p className="eyebrow">Minha coleção</p><h1 className="mt-2 font-display text-3xl font-bold">Álbum de figurinhas</h1></div><Link href="/aluno" className="button-secondary"><ArrowLeft size={17}/>Voltar</Link></header><StickerAlbum stickers={stickers} listings={listings} ownListings={ownListings} donations={donations} devCoins={student.devCoins} remainingPacks={Math.max(0,DAILY_STICKER_PACK_LIMIT-packs)} treasuryStock={treasuryStock} patent={progress?.level?.name??"Bronze I"} score={progress?.score??0} marketEnabled={marketEnabled}/></div></main>
}
