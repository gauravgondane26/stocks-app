import Link from "next/link";

const FooterLink = ({ text, linkText, href }: FooterLinkProps) => {
  return (
    <p className="pt-4 text-center text-sm text-gray-500">
      {text}{" "}
      <Link href={href} className="footer-link">
        {linkText}
      </Link>
    </p>
  );
};

export default FooterLink;
