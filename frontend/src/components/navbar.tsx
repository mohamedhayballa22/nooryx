"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuContent,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-md transition-all duration-200"
      style={{
        borderBottom: isScrolled
          ? "0.1px solid var(--navbar-border)"
          : "0.1px solid transparent"
      }}
    >
      <div className="mx-auto max-w-screen-2xl flex items-center justify-start h-20 px-6 gap-8">
        <Link href="/" className="flex items-center">
            <Image
            src="/mock-logo-full.svg"
            alt="Mock Logo"
            width={20}
            height={20}
            className="h-7 w-auto"
            />
        </Link>

        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/">Home</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Features</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-2 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-4">
                        <NavigationMenuLink asChild>
                        <a
                            className="from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-linear-to-b p-6 no-underline outline-hidden select-none focus:shadow-md"
                            href="/"
                        >
                            <div className="mt-4 mb-2 text-lg font-medium">
                            Real-Time Visibility
                            </div>
                            <p className="text-muted-foreground text-sm leading-tight">
                            Everything you need to manage inventory and operations in one powerful platform.
                            </p>
                        </a>
                        </NavigationMenuLink>
                    </li>
                  <ListItem href="/features/inventory" title="Inventory Tracking">
                    Monitor stock levels in real-time.
                  </ListItem>
                  <ListItem href="/features/suppliers" title="Supplier Management">
                    Manage vendors and purchase orders.
                  </ListItem>
                  <ListItem href="/features/reports" title="Reports & Analytics">
                    Get insights into sales and inventory trends.
                  </ListItem>
                  <ListItem href="/features/multi-user" title="Multi-User Access">
                    Collaborate with your whole team.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[300px] gap-4">
                  <ListItem href="/blog" title="Blog">
                    Tips and insights on inventory management.
                  </ListItem>
                  <ListItem href="/docs" title="Documentation">
                    Learn how to set up and use Nooryx.
                  </ListItem>
                  <ListItem href="/faq" title="FAQs">
                    Answers to common questions.
                  </ListItem>
                  <ListItem href="/case-studies" title="Case Studies">
                    See how businesses use Nooryx.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/pricing">Pricing</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/about">About Us</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <Link href="/contact">Contact</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-3 ml-auto">
            <Button asChild variant="outline">
            <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
            <Link href="/demo">Book a Demo</Link>
            </Button>
        </div>
        </div>
    </header>
  )
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}
