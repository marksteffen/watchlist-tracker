import { ActivityIndicator } from 'react-native'

interface Props {
  color?: string
}

export function Spinner({ color = '#10b981' }: Props) {
  return <ActivityIndicator size="small" color={color} />
}
