import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar reservas expiradas
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('cart_reservations')
      .select('id, variant_id, quantity, session_id, product_name, size, color')
      .lt('expires_at', new Date().toISOString())

    if (fetchError) {
      throw fetchError
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired reservations found', cleaned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${expiredReservations.length} expired reservations to clean up`)

    // Deletar reservas expiradas (o trigger irá restaurar o estoque automaticamente)
    const { error: deleteError } = await supabase
      .from('cart_reservations')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (deleteError) {
      throw deleteError
    }

    console.log(`Successfully cleaned up ${expiredReservations.length} expired reservations`)

    return new Response(
      JSON.stringify({ 
        message: 'Expired reservations cleaned up successfully',
        cleaned: expiredReservations.length,
        details: expiredReservations.map(r => ({
          product: r.product_name,
          size: r.size,
          color: r.color,
          quantity: r.quantity
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error cleaning up expired reservations:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
