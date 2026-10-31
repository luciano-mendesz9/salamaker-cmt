import Link from "next/link";
import { KeyRound } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { ProfessorNavigation } from "./professor-navigation";
import styles from "./professor-navigation.module.css";

export function ProfessorShell({ title, children }: { title: string; children: React.ReactNode }) {
  const showLocalAssets = process.env.NODE_ENV !== "production" && process.env.ENABLE_LOCAL_ASSET_MANAGER === "true";

  return <div className={styles.shell}>
    <ProfessorNavigation showLocalAssets={showLocalAssets}/>
    <main className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.pageHeading}>
          <span className={styles.pageEyebrow}>Sala Maker <span aria-hidden="true">/</span> Professor</span>
          <h1>{title}</h1>
        </div>
        <div className={styles.topActions}>
          <Link href="/professor/conta" aria-label="Minha conta e senha" title="Minha conta e senha" className={styles.accountButton}><KeyRound size={18}/></Link>
          <LogoutButton/>
        </div>
      </header>
      <div className={styles.pageBody}>{children}</div>
    </main>
  </div>;
}
