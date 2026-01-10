import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { NooryxFontBold } from '@/app/fonts/typeface'

export default function HeroSection() {
    return (
        <>
            <div className="overflow-hidden">
                <div className="pb-16 sm:pb-24 relative">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="text-center sm:mx-auto">
                            <h1 className={`mx-auto mt-4 lg:mt-8 max-w-4xl ${NooryxFontBold.className} text-balance text-5xl max-md:font-semibold md:text-7xl xl:text-[5.25rem]`}>
                                Fast to use. Exact by design.
                            </h1>
                            <p className="mx-auto mt-8 max-w-2xl text-balance text-lg">
                                Nooryx is the inventory operations platform built for high velocity teams who need instant actions and precise results.
                            </p>

                            <div className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                <Button
                                    asChild
                                    size="lg">
                                    <Link href="#">
                                        <span className="text-nowrap">Book a demo</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="lg"
                                    variant="outline">
                                    <Link href="/waitlist">
                                        <span className="text-nowrap">Early access</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mask-b-from-55% relative mt-12 md:mt-20 md:ml-0 overflow-visible md:overflow-hidden px-6">
                        <div className="relative mx-auto max-w-6xl">
                            {/* Dark mode image */}
                            <div className="hidden dark:block relative rounded-[6px] sm:rounded-[11px] md:rounded-[16px] bg-gradient-to-br from-white/20 via-white/5 to-transparent p-[1px]">
                                <Image
                                    className="relative w-auto h-full max-md:min-w-[160%] md:w-full rounded-[4px] md:rounded-2xl"
                                    src="/ui/nooryx-dashboard-dark-ui.avif"
                                    alt="Nooryx dashboard interface in dark mode"
                                    width="3584"
                                    height="2240"
                                    draggable="false"
                                    placeholder="blur"
                                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzU4NCIgaGVpZ2h0PSIyMjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMwYTBhMGEiLz48L3N2Zz4="
                                />
                            </div>

                            {/* Light mode image */}
                            <div className="relative rounded-[6px] sm:rounded-[11px] md:rounded-[16px] bg-gradient-to-br from-black/15 via-black/8 to-transparent p-[1px] dark:hidden">
                                <Image
                                    className="relative w-auto h-full max-md:min-w-[160%] md:w-full rounded-[4px] md:rounded-2xl"
                                    src="/ui/nooryx-dashboard-light-ui.avif"
                                    alt="Nooryx dashboard interface in light mode"
                                    width="3584"
                                    height="2240"
                                    draggable="false"
                                    placeholder="blur"
                                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzU4NCIgaGVpZ2h0PSIyMjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmYWZhZmEiLz48L3N2Zz4="
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
