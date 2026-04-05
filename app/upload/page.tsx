import { AnimatedBackground } from '@/components/anton/animated-background'
import { PDFUploadParser } from '@/components/anton/pdf-upload-parser'

export default function UploadPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <PDFUploadParser />
        </div>
      </main>
    </AnimatedBackground>
  )
}
