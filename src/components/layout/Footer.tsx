import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left side - Siembra NC */}
          <div className="flex items-center gap-3">
            <Image
              src="/siembra-logo.webp"
              alt="Siembra NC"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-sm text-gray-400">
              Siembra NC Volunteer Management System
            </span>
          </div>

          {/* Center - Navigation */}
          <nav className="flex gap-6 text-sm">
            <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
              About
            </Link>
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
              Login
            </Link>
          </nav>

          {/* Right side - Powered by Ripple */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Image
              src="/honeybadger-logo.png"
              alt="Honey Badger Apps"
              width={16}
              height={16}
              className="inline-block opacity-70"
            />
            <span>A Honey Badger App</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-800">
          &copy; {new Date().getFullYear()} Siembra NC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
