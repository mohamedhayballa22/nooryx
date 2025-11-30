"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* Huge 404 background*/}
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1 }}
        className="absolute text-[40vw] font-extrabold leading-none bg-gradient-to-t from-muted-foreground/80 via-muted-foreground/20 to-muted-foreground/10 bg-clip-text text-transparent select-none pointer-events-none"
        aria-hidden="true"
      >
        404
      </motion.h1>

      {/* Foreground content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative z-10 text-center px-6 max-w-2xl"
      >
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          You&apos;ve wandered outside the warehouse!
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">
          We checked the shelves twice. Nothing here by that name.
        </p>
        <Button asChild size="lg">
          <Link href="/">Head Home</Link>
        </Button>
      </motion.div>
    </main>
  );
}
