import { ProvidersSimple } from '../providers-simple';

export default function MinimalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProvidersSimple>{children}</ProvidersSimple>
  );
} 