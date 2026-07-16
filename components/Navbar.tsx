'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, BarChart3, Users, Settings } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
    { name: 'CRM', href: '/dashboard/crm', icon: Users },
    { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
          scrolled
            ? 'bg-white/80 backdrop-blur-md border-gray-200 shadow-sm'
            : 'bg-white border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-serif font-bold text-xl">A</span>
                </div>
                <span className="font-serif font-bold text-2xl tracking-tight text-gray-900">
                  Sistema ADM
                </span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-400 group-hover:text-black transition-colors" />
                    {link.name}
                  </Link>
                );
              })}
              <div className="pl-6 border-l border-gray-200">
                <button className="text-sm font-medium text-white bg-black hover:bg-gray-800 px-5 py-2.5 rounded-full transition-all shadow-md hover:shadow-lg">
                  Sair
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-black hover:bg-gray-100 transition-colors focus:outline-none"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {isOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile Menu Panel (Sliding from top) */}
      <div
        className={`fixed top-0 left-0 w-full bg-white z-40 shadow-xl border-b border-gray-100 rounded-b-3xl transition-transform duration-500 ease-in-out md:hidden ${
          isOpen ? 'translate-y-20' : '-translate-y-full'
        }`}
        style={{ height: '50vh' }}
      >
        <div className="px-6 py-8 h-full flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-4 text-lg font-medium text-gray-700 hover:text-black transition-colors"
                >
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                  {link.name}
                </Link>
              );
            })}
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100">
            <button className="w-full text-base font-medium text-white bg-black py-3 rounded-xl transition-colors hover:bg-gray-800 shadow-md">
              Sair
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
