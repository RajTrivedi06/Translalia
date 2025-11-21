import { redirect } from "@/i18n/routing";

export default function RootRedirectPage() {
  redirect({
    href: "/",
    locale: "en",
  });
}
