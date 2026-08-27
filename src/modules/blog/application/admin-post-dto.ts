import type { SelectedImage } from "@/modules/media/domain/selected-image";

export type AdminPostEditorDto = {
  body: string;
  categoryId: string | null;
  contentId: string;
  excerpt: string;
  externalUrl: string;
  image?: SelectedImage;
  isSpoiler: boolean;
  locationId: string | null;
  lockVersion: number;
  postedAt: string;
  projectId: string | null;
  publishAt: string;
  slug: string;
  status: "draft" | "published" | "hidden";
  tagIds: string[];
  title: string;
  watermarkEnabled: boolean;
};

export type AdminPostListItemDto = {
  contentId: string;
  deletedAt: string | null;
  lockVersion: number;
  publishAt: string | null;
  slug: string;
  status: "draft" | "published" | "hidden";
  title: string | null;
  updatedAt: string;
};
