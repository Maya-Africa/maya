interface ProductCardProps {
  image: string
  title: string
  priceNaira: number
  priceSats: number
}

export default function ProductCard({
  image,
  title,
  priceNaira,
  priceSats,
}: ProductCardProps) {
  const formattedNaira = priceNaira.toLocaleString('en-US')
  const formattedSats = priceSats.toLocaleString('en-US')

  return (
    <div
      className="bg-maya-surface rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow active:scale-95 text-left cursor-pointer"
    >
      {/* Product Image - Square */}
      <div className="w-full aspect-square bg-gray-200 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Product Title */}
        <h3 className="font-serif text-[18px] text-maya-text font-normal line-clamp-2 mb-3">
          {title}
        </h3>

        {/* Price in Naira */}
        <p className="text-[#D67961] font-medium text-[18px] mb-1" style={{ textDecoration: 'none' }}>
          ₦{formattedNaira}
        </p>

        {/* Price in Sats */}
        <p className="text-[#7D6F66] text-[13px] font-normal" style={{ textDecoration: 'none' }}>
          {formattedSats} sats
        </p>
      </div>
    </div>
  )
}
