export type PublicImageDto = {
  altText: string;
  height: number;
  url: string;
  width: number;
};

export type PublicProjectSummaryDto = {
  description: string | null;
  id: string;
  name: string;
  slug: string;
  themeKey: string;
};

export type PublicTagDto = {
  label: string;
  slug: string;
};

export type PublicContentSummaryDto = {
  excerpt: string | null;
  feedEventType: "new" | "updated" | null;
  href: string;
  id: string;
  image: PublicImageDto | null;
  kind: "library" | "page" | "post" | "work";
  project: PublicProjectSummaryDto | null;
  publishedAt: string;
  title: string;
};

export type PublicPostDto = {
  body: string;
  category: PublicTagDto | null;
  excerpt: string | null;
  externalUrl: string | null;
  feedEventType: "new" | "updated" | null;
  id: string;
  image: PublicImageDto | null;
  isSpoiler: boolean;
  location: { displayName: string; mapsQuery: string } | null;
  postedAt: string;
  project: PublicProjectSummaryDto | null;
  publishAt: string;
  slug: string;
  tags: PublicTagDto[];
  title: string | null;
  updatedAt: string;
};

export type PublicWorkDto = {
  description: string;
  excerpt: string | null;
  externalUrl: string | null;
  id: string;
  image: PublicImageDto | null;
  project: PublicProjectSummaryDto | null;
  publishedAt: string;
  releasedOn: string | null;
  showInPortfolio: boolean;
  slug: string;
  summary: string | null;
  title: string;
  type: string;
};

export type PublicLibraryDto = {
  accessPolicy: string;
  cover: PublicImageDto | null;
  description: string;
  downloadEnabled: boolean;
  excerpt: string | null;
  id: string;
  project: PublicProjectSummaryDto | null;
  publishedAt: string;
  slug: string;
  tags: PublicTagDto[];
  title: string;
};

export type PublicPageDto = {
  body: string;
  description: string | null;
  title: string;
  updatedAt: string;
};

export type PublicNoticeDto = {
  body: string;
  id: string;
  linkLabel: string | null;
  linkUrl: string | null;
  title: string;
};

export type PublicBusinessCardDto = {
  address: string | null;
  displayName: string;
  email: string | null;
  jobTitle: string | null;
  note: string | null;
  organization: string | null;
  phone: string | null;
  pngAvailable: boolean;
  slug: string;
  website: string | null;
};
