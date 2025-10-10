"use client";

import { useEffect, useRef } from "react";
import LoadingBar, { LoadingBarRef } from "react-top-loading-bar";
import { usePathname } from "next/navigation";

export default function TopLoadingBar() {
  const ref = useRef<LoadingBarRef>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.continuousStart();

    const timer = setTimeout(() => {
      ref.current?.complete();
    }, 200);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <LoadingBar
      ref={ref}
      color="#3b82f6"
      height={1.5}
      shadow={true}
    />
  );
}
