// Card now lives in the shared @repo/ui package (promoted so the new
// marketplace flows and the admin app can share it). This re-export keeps the
// existing `@/components/ui/card` import sites working unchanged.
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@repo/ui';
