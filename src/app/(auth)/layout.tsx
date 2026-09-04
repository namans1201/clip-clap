import { Toaster } from '@/components/ui/sonner';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/*
        Sonner portals its toasts straight to document.body, so they sit
        outside login.module.css's `.wrapper` (which pins the login page's
        original font) — without this override, toasts here would pick up
        the app-wide Gambetta body-text default instead. The login page is
        off-limits for visual changes, so this keeps that promise for
        toasts too.
      */}
      <Toaster
        position="bottom-right"
        style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      />
    </>
  );
}
