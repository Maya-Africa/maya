interface SellerProductCardProps {
  image: string
  title: string
  priceNaira: number
  priceSats: number
  status: 'Active' | 'Sold'
}

export default function SellerProductCard({
  image,
  title,
  priceNaira,
  priceSats,
  status,
}: SellerProductCardProps) {
  const formattedNaira = priceNaira.toLocaleString('en-US')
  const formattedSats = priceSats.toLocaleString('en-US')

  const statusColor = status === 'Active' ? 'bg-[#2D5F5D]' : 'bg-[#7D6F66]'

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow active:scale-95 text-left cursor-pointer relative">
      {/* Product Image - Square */}
      <div className="w-full aspect-square bg-gray-200 overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>

      {/* Status Badge - Top Right */}
      <div
        className={`absolute top-3 right-3 ${statusColor} text-white px-2 py-1 rounded text-[11px] font-medium`}
      >
        {status}
      </div>

      {/* Card Content */}
      <div className="p-4">
        {/* Product Title */}
        <h3 className="font-serif text-[18px] text-[#1F1410] font-normal line-clamp-2 mb-3">
          {title}
        </h3>

        {/* Price in Naira */}
        <p
          className="text-[#D67961] font-medium text-[18px] mb-1"
          style={{ textDecoration: 'none' }}
        >
          ₦{formattedNaira}
        </p>

        {/* Price in Sats */}
        <p
          className="text-[#7D6F66] text-[13px] font-normal"
          style={{ textDecoration: 'none' }}
        >
          {formattedSats} sats
        </p>
      </div>
    </div>
  )
}
