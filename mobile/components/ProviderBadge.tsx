import { Image, View } from 'react-native'

interface Props {
  logoPath: string | null
  providerName: string
  size?: number
}

export function ProviderBadge({ logoPath, providerName, size = 24 }: Props) {
  if (!logoPath) return null
  return (
    <View style={{ width: size, height: size, borderRadius: 4, overflow: 'hidden' }}>
      <Image
        source={{ uri: logoPath }}
        style={{ width: size, height: size }}
        accessibilityLabel={providerName}
      />
    </View>
  )
}
