import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';
export default function Loading(){return <SkeletonPage label="Cargando sustituciones"><div className="space-y-4"><Skeleton className="h-12 w-full max-w-xl rounded-2xl"/><Skeleton className="h-80 rounded-2xl"/></div></SkeletonPage>}
