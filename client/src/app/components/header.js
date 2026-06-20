import Image from "next/image";
import styles from "./css/header.module.css";

export default function Header() {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.logo}>
            <Image 
              src="/logoni1.png" 
              alt="Logo" 
              height={100}
              width={100}
              className={styles.logoImage}
              unoptimized
              priority
            />
        </div>
      </div>
    </>
  );
}