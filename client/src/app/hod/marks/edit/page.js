"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditMarksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/marks");
  }, [router]);

  return null;
}
