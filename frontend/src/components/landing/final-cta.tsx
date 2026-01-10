import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { NooryxFontBold } from '@/app/fonts/typeface'

export default function FinalCTASection() {
    return (
        <section className="py-12 sm:py-24 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6">
                <div className="relative w-full max-w-6xl mx-auto">
                    
                    {/* Background Image */}
                    <div className="relative w-full aspect-square sm:aspect-auto rounded-2xl overflow-hidden">
                        <Image
                            src="/final-cta-bg.avif"
                            alt="Abstract gradient background"
                            width={1920}
                            height={763}
                            quality={90}
                            className="w-full h-full object-cover"
                            draggable="false"
                            priority
                        />
                        
                        {/* Content Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                            <h2 className={`${NooryxFontBold.className} text-3xl sm:text-4xl md:text-5xl text-pretty leading-[1.1] mb-8 text-white max-w-3xl`}>
                                Ready to end the compromise between speed and certainty?
                            </h2>
                            
                            <div className="flex flex-col items-center justify-center gap-2 md:flex-row">
                                <Button
                                    asChild
                                    size="lg"
                                    className="bg-white text-black hover:bg-white/90">
                                    <Link href="#">
                                        <span className="text-nowrap">Book a demo</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="lg"
                                    variant="outline"
                                    className="border-white/25 bg-transparent text-white hover:bg-white/20 hover:text-white">
                                    <Link href="/waitlist">
                                        <span className="text-nowrap">Early access</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
        </section>
    )
}
