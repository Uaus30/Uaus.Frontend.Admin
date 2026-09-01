import { Mail, MapPin } from "lucide-react";
import { Link } from "wouter";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useGetStorefrontCompany } from "@workspace/api-client-react";
import { NAV_LINKS } from "@/routes";
import { SITE_CONTACT, SITE_FOOTER_TAGLINE, SITE_NAME, SITE_PHONES, SITE_TAGLINE } from "@/lib/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import logoUrl from "@/assets/logo.png";

/** Mensagem que já abre digitada no WhatsApp — diz a quem atende de onde veio o contato. */
const FOOTER_WHATSAPP_MESSAGE = "Olá! Vim pelo site da Uaus.";

/**
 * Rodapé escuro em quatro colunas, portado do site original.
 *
 * Endereço e CNPJ preferem o cadastro de Configurações da Empresa (endpoint
 * público `/Storefront/company`) e caem nas constantes de `lib/site.ts` quando
 * vazios — o admin vira a fonte, sem quebrar o rodapé se a API estiver fora do
 * ar.
 *
 * Os TELEFONES são a exceção, e é deliberado. O `StorefrontCompanyDto` tem um
 * `phone` só, sem nome de quem atende, e o que está gravado nele hoje é o
 * celular de um sócio — o rodapé anunciava "Cel: (44) 99137-2305" como se
 * fosse o número da loja. A coluna passa a listar os três canais de
 * `SITE_PHONES`, cada um com rótulo e link para o próprio WhatsApp, e é o
 * único lugar do site onde os três aparecem: o rodapé está em toda página, e
 * quem procura falar com uma pessoa específica encontra sem precisar navegar.
 */
export function SiteFooter() {
  const { data: company } = useGetStorefrontCompany();

  const addressLine = company?.addressLine || SITE_CONTACT.addressLine;
  const addressDistrict = company?.cityState || SITE_CONTACT.addressDistrict;
  const documentLine = company?.document || SITE_CONTACT.cnpjLine;

  return (
    <footer className="bg-foreground pb-8 pt-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="" className="h-12 w-12 object-contain" />
              <div className="flex flex-col">
                <span className="font-display text-3xl leading-none font-black text-primary">
                  {SITE_NAME}
                </span>
                <span className="font-display text-xs font-bold tracking-[0.2em] text-white/80">
                  {SITE_TAGLINE}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{SITE_FOOTER_TAGLINE}</p>
            <div className="mt-6 flex gap-3">
              <a
                href={SITE_CONTACT.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram da Uaus"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-primary"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
              <a
                href={buildWhatsAppUrl(FOOTER_WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp da Uaus"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-primary"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold">Contato</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {SITE_PHONES.map((sitePhone) => (
                <li key={sitePhone.number} className="flex items-center gap-3">
                  <WhatsAppIcon className="h-4 w-4 shrink-0 text-primary" />
                  <a
                    href={buildWhatsAppUrl(FOOTER_WHATSAPP_MESSAGE, sitePhone.number)}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-white"
                  >
                    {sitePhone.label}: {sitePhone.display}
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                {SITE_CONTACT.email}
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a
                  href={SITE_CONTACT.mapsPlaceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {addressLine}
                  <br />
                  {addressDistrict}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold">Navegação</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {NAV_LINKS.map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold">Onde estamos</h3>
            <iframe
              title="Mapa da localização da loja"
              src={SITE_CONTACT.mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="mt-4 h-48 w-full rounded-xl border-0"
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-sm text-white/60 sm:flex-row">
          <span>© 2026 Uaus! Máximo 30. Todos os direitos reservados.</span>
          <span>{documentLine}</span>
        </div>
      </div>
    </footer>
  );
}
