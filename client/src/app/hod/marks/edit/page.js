"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditMarksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/hod/marks");
  }, [router]);

  return null;
}
