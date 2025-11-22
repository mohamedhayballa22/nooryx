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
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { MoveRight, Menu, ChevronDown } from "lucide-react"

export default function GuestNavbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const { isAuthenticated } = useAuth ? useAuth() : { isAuthenticated: false }
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setExpandedSection(null)
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-background/60 backdrop-blur-md transition-all duration-200 h-20"
      style={{
        borderBottom: isScrolled
          ? "0.1px solid var(--navbar-border)"
          : "0.1px solid transparent"
      }}
    >
      <div className="mx-auto max-w-screen-2xl flex items-center justify-between h-full px-6">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
            <Image
            src="/mock-logo-full.svg"
            alt="Mock Logo"
            width={20}
            height={20}
            className="h-7 w-auto"
            />
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:block">
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
                            <Link
                                className="from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-linear-to-b p-6 no-underline outline-hidden select-none focus:shadow-md"
                                href="/"
                            >
                                <div className="mt-4 mb-2 text-lg font-medium">
                                Real-Time Visibility
                                </div>
                                <p className="text-muted-foreground text-sm leading-tight">
                                Everything you need to manage inventory and operations in one powerful platform.
                                </p>
                            </Link>
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
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Button variant="outline" className="cursor-pointer" onClick={() => router.push('/core/dashboard')}>
              Go to App
              <MoveRight className="ml-1 mt-0.5 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/demo">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Trigger */}
        <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
            <Menu />
        </Button>
      </div>

      {/* Mobile Menu Content */}
      {isMobileMenuOpen && (
        <div className="absolute top-20 left-0 right-0 bg-background border-b p-6 md:hidden flex flex-col gap-4 animate-in slide-in-from-top-2 max-h-[calc(100vh-5rem)] overflow-y-auto">
            <nav className="flex flex-col gap-2">
                <Link 
                  href="/" 
                  className="text-lg font-medium p-2 hover:bg-muted rounded-md" 
                  onClick={closeMobileMenu}
                >
                  Home
                </Link>
                
                {/* Features Accordion */}
                <div className="flex flex-col">
                  <button
                    className="text-lg font-medium p-2 hover:bg-muted rounded-md flex items-center justify-between w-full text-left"
                    onClick={() => toggleSection('features')}
                  >
                    Features
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform duration-200 ${
                        expandedSection === 'features' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedSection === 'features' && (
                    <div className="flex flex-col gap-1 pl-4 mt-2 border-l-2 border-muted">
                      <Link
                        href="/features/inventory"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Inventory Tracking</div>
                        <p className="text-muted-foreground text-xs">Monitor stock levels in real-time.</p>
                      </Link>
                      <Link
                        href="/features/suppliers"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Supplier Management</div>
                        <p className="text-muted-foreground text-xs">Manage vendors and purchase orders.</p>
                      </Link>
                      <Link
                        href="/features/reports"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Reports & Analytics</div>
                        <p className="text-muted-foreground text-xs">Get insights into sales and inventory trends.</p>
                      </Link>
                      <Link
                        href="/features/multi-user"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Multi-User Access</div>
                        <p className="text-muted-foreground text-xs">Collaborate with your whole team.</p>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Resources Accordion */}
                <div className="flex flex-col">
                  <button
                    className="text-lg font-medium p-2 hover:bg-muted rounded-md flex items-center justify-between w-full text-left"
                    onClick={() => toggleSection('resources')}
                  >
                    Resources
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform duration-200 ${
                        expandedSection === 'resources' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedSection === 'resources' && (
                    <div className="flex flex-col gap-1 pl-4 mt-2 border-l-2 border-muted">
                      <Link
                        href="/blog"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Blog</div>
                        <p className="text-muted-foreground text-xs">Tips and insights on inventory management.</p>
                      </Link>
                      <Link
                        href="/docs"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Documentation</div>
                        <p className="text-muted-foreground text-xs">Learn how to set up and use Nooryx.</p>
                      </Link>
                      <Link
                        href="/faq"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">FAQs</div>
                        <p className="text-muted-foreground text-xs">Answers to common questions.</p>
                      </Link>
                      <Link
                        href="/case-studies"
                        className="p-2 hover:bg-muted rounded-md"
                        onClick={closeMobileMenu}
                      >
                        <div className="font-medium text-sm">Case Studies</div>
                        <p className="text-muted-foreground text-xs">See how businesses use Nooryx.</p>
                      </Link>
                    </div>
                  )}
                </div>

                <Link 
                  href="/pricing" 
                  className="text-lg font-medium p-2 hover:bg-muted rounded-md" 
                  onClick={closeMobileMenu}
                >
                  Pricing
                </Link>
                
                <Link 
                  href="/about" 
                  className="text-lg font-medium p-2 hover:bg-muted rounded-md" 
                  onClick={closeMobileMenu}
                >
                  About Us
                </Link>

                <Link 
                  href="/contact" 
                  className="text-lg font-medium p-2 hover:bg-muted rounded-md" 
                  onClick={closeMobileMenu}
                >
                  Contact
                </Link>
            </nav>
            
            <div className="h-px bg-border my-2" />
            
            <div className="flex flex-col gap-2">
                {isAuthenticated ? (
                  <Button 
                    variant="default" 
                    className="w-full justify-start cursor-pointer" 
                    onClick={() => {
                      closeMobileMenu()
                      router.push('/core/dashboard')
                    }}
                  >
                    Go to App
                    <MoveRight className="ml-1 mt-0.5 h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/login">Log In</Link>
                    </Button>
                    <Button className="w-full justify-start" asChild>
                        <Link href="/demo">Get Started</Link>
                    </Button>
                  </>
                )}
            </div>
        </div>
      )}
    </header>
  )
}

function ListItem({ title, children, href, ...props }: any) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">{children}</p>
        </Link>
      </NavigationMenuLink>
    </li>
  )
}
