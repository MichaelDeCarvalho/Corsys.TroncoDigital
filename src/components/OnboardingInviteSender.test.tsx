import {fireEvent,render,screen,waitFor} from '@testing-library/react'
import {vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {OnboardingDraft} from '../lib/master-onboarding'
import {OnboardingInviteSender} from './OnboardingInviteSender'
const run={id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',status:'awaiting_invite',current_step:'invite',organization_id:'tenant',prospective_name:'QA',invite_email:'qa@example.test'} as OnboardingDraft
function setup(invoke=vi.fn().mockResolvedValue({data:{outcome:'auth_accepted'},error:null}),runs=[run]){
 render(<OnboardingInviteSender client={{functions:{invoke}} as unknown as SupabaseClient} runs={runs}/>);return invoke
}
test('does not offer sending for drafts or completed runs',()=>{
 setup(undefined,[{...run,status:'draft'},{...run,status:'completed'}]);expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
test('dispatches once and distinguishes service acceptance from delivery',async()=>{
 const invoke=setup();const button=screen.getByRole('button');fireEvent.click(button);fireEvent.click(button)
 await screen.findByText(/Convite aceito pelo serviço/)
 expect(invoke).toHaveBeenCalledTimes(1);expect(invoke).toHaveBeenCalledWith('onboarding-invite?run_id='+run.id,{body:{}})
 expect(button).toBeDisabled()
})
test.each(['transport','permission','malformed'])('uncertain %s response blocks a blind retry',async kind=>{
 const invoke=kind==='transport'?vi.fn().mockRejectedValue(new Error('transport')):vi.fn().mockResolvedValue(kind==='permission'?{error:{message:'forbidden'},data:null}:{data:{outcome:'unknown'},error:null})
 setup(invoke);const button=screen.getByRole('button');fireEvent.click(button)
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Envio não confirmado'))
 fireEvent.click(button);expect(invoke).toHaveBeenCalledTimes(1);expect(button).toBeDisabled()
})
