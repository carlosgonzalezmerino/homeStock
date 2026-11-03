/** Props accepted by {@link ProductThumbnail}. */
interface ProductThumbnailProps {
  imageUrl: string | null | undefined;
  alt: string;
  placeholderIcon: string;
  sizeClass?: string;
}

/**
 * Product image with a Material icon fallback when the product has no picture.
 *
 * @param props - Image URL, alternative text, fallback icon name and size classes.
 * @returns An `img` element, or an icon placeholder without a picture.
 */
export function ProductThumbnail({
  imageUrl,
  alt,
  placeholderIcon,
  sizeClass = "h-12 w-12",
}: ProductThumbnailProps) {
  if (imageUrl) {
    return <img src={imageUrl} alt={alt} className={`${sizeClass} shrink-0 rounded-sm bg-surface-container-low object-contain`} />;
  }
  return (
    <span
      data-testid="img-placeholder"
      className={`material-symbols-outlined flex ${sizeClass} shrink-0 items-center justify-center rounded-sm bg-surface-container-low text-2xl text-on-surface-variant`}
    >
      {placeholderIcon}
    </span>
  );
}
