import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shopifyService } from '@/lib/api/shopify'
import { type ShopifyConnectRequest } from '@/lib/api/shopify'

export const SHOPIFY_QUERY_KEY = ['shopify', 'status']

/**
 * Query hook for Shopify integration status
 */
export function useShopifyStatus() {
  return useQuery({
    queryKey: SHOPIFY_QUERY_KEY,
    queryFn: () => shopifyService.getStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Mutation hook to initiate Shopify connection
 */
export function useConnectShopify() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ShopifyConnectRequest) => shopifyService.connect(data),
    onSuccess: (data) => {
      // Redirect to Shopify OAuth URL
      window.location.href = data.authorization_url
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to connect to Shopify'
      toast.error(message)
    },
  })
}

/**
 * Mutation hook to disconnect Shopify
 */
export function useDisconnectShopify() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => shopifyService.disconnect(),
    onSuccess: () => {
      // Invalidate status query to refresh UI
      queryClient.invalidateQueries({ queryKey: SHOPIFY_QUERY_KEY })
      toast.success('Shopify disconnected successfully')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to disconnect Shopify'
      toast.error(message)
    },
  })
}
