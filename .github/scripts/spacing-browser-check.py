"""Real app startup with an isolated fake backend: schedule, Henk, mobile layout."""
import json
from datetime import datetime, timedelta, timezone
from playwright.sync_api import expect


def check_spacing(browser, origin, diagnostics):
    context = browser.new_context(service_workers='block', viewport={'width':390,'height':844})
    context.add_init_script("""window.VRIENDENWEEKEND_CONFIG={supabaseUrl:'https://spacing-test.supabase.co',supabasePublishableKey:'local-test-key'};""")
    start = datetime.now(timezone.utc) + timedelta(minutes=5)
    schedule = {'eventId':'event','enabled':True,'scheduledAt':start.isoformat(),'departedAt':None}
    state = {'noticeId': None, 'schedule': schedule}
    def network(route):
        url = route.request.url
        if url.startswith(origin + '/'):
            route.continue_(); return
        if '/auth/v1/signup' in url:
            route.fulfill(json={'access_token':'e30.eyJzdWIiOiJ0ZXN0In0.signature','token_type':'bearer','refresh_token':'test','expires_in':3600,'user':{'id':'user','aud':'authenticated','role':'authenticated','is_anonymous':True}}); return
        if '/rpc/get_dashboard_snapshot' in url:
            now = datetime.now(timezone.utc).isoformat()
            route.fulfill(json={'serverNow':now,'generatedAt':now,'teams':[
                {'id':'team-a','name':'Speurneuzen','code':'ABCDEF','status':'active','score':0,'createdAt':now,'updatedAt':now,'participants':[],'stopProgress':[]},
                {'id':'team-b','name':'Drakenjagers','code':'GHJKLM','status':'active','score':0,'createdAt':now,'updatedAt':now,'participants':[],'stopProgress':[]}]}); return
        if '/rpc/dashboard_get_spacing' in url: route.fulfill(json=[]); return
        if '/rpc/dashboard_plan_spacing' in url:
            data=route.request.post_data_json
            assert data['p_team_ids']==['team-b','team-a'],data
            assert data['p_interval_minutes']==5 and data['p_gap_m']==100,data
            route.fulfill(json='event'); return
        if '/rpc/get_team_spacing' in url:
            data = route.request.post_data_json
            if data.get('p_depart'): state['schedule']['departedAt'] = datetime.now(timezone.utc).isoformat()
            if data.get('p_acknowledge'): state['noticeId'] = None
            route.fulfill(json={**state,'serverNow':datetime.now(timezone.utc).isoformat()}); return
        if '/rpc/get_team_radio_messages' in url: route.fulfill(json={'messages':[],'ok':True}); return
        if '/rpc/heartbeat_team_session' in url: route.fulfill(json={'ok':True,'lastSeenAt':datetime.now(timezone.utc).isoformat(),'activeSessionCount':1}); return
        if '/rpc/' in url: route.fulfill(status=503,json={'message':'SYNC_UNAVAILABLE'}); return
        route.abort()
    context.route('**/*', network)
    page=context.new_page()
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(origin+'/escape-the-city/',wait_until='load')
        page.wait_for_function("document.querySelector('#root')?.children.length>0")
        page.evaluate("""async () => {
          const db=await new Promise(resolve=>{const r=indexedDB.open('moerasdraak-storage',2);r.onsuccess=()=>resolve(r.result)});
          const now=new Date().toISOString(), id='spacing-test';
          const tx=db.transaction(['teams','progress','team-sessions'],'readwrite');
          tx.objectStore('teams').put({id,gameSlug:'moerasdraak-den-bosch',gameVersion:1,name:'Speurneuzen',memberNames:[],privacyAccepted:true,createdAt:now,updatedAt:now,lastActivityAt:now});
          tx.objectStore('team-sessions').put({teamId:id,id:'session',deviceId:'device',joinedAt:now,lastSeenAt:now});
          tx.objectStore('progress').put({teamId:id,gameSlug:'moerasdraak-den-bosch',gameVersion:1,currentStopId:'drakenfontein',collectedRewards:[],wrongAttempts:0,totalHintsUsed:0,totalScore:0,finalized:false,version:1,stopProgress:{drakenfontein:{state:'available',attempts:0,hintsUsed:0,scoreAwarded:0,answerData:{}}}});
          await new Promise(resolve=>tx.oncomplete=resolve);db.close();
          localStorage.setItem('moerasdraak-last-team',id);
          localStorage.setItem('moerasdraak-settings',JSON.stringify({soundEnabled:false,backgroundMusicEnabled:false,highContrastEnabled:false,installDismissedAt:now}));
          location.hash='/route';
        }""")
        page.reload(wait_until='load')
        expect(page.get_by_role('heading',name='Nog even geduld, speurneuzen!')).to_be_visible(timeout=15000)
        expect(page.get_by_role('button',name='Wachten op vertrek')).to_be_disabled()
        page.screenshot(path=str(diagnostics/'spacing-start-390.png'),full_page=True)
        state['schedule']['scheduledAt']=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat()
        expect(page.get_by_role('button',name='Start jullie avontuur')).to_be_enabled(timeout=15000)
        page.get_by_role('button',name='Start jullie avontuur').click()
        expect(page.get_by_role('heading',name='Klaar voor jullie avontuur?')).not_to_be_visible()
        state['noticeId']='notice'
        notice=page.get_by_role('region',name='Bericht van Hint Henk')
        expect(notice).to_be_visible(timeout=15000)
        for width in (320,390):
            page.set_viewport_size({'width':width,'height':740})
            box=notice.bounding_box()
            assert box['x']>=0 and box['x']+box['width']<=width+1,box
            assert box['y']>=0 and box['y']+box['height']<=741,box
            assert notice.evaluate('e=>e.scrollWidth<=e.clientWidth')
            page.screenshot(path=str(diagnostics/f'spacing-henk-{width}.png'),full_page=True)
        page.get_by_role('button',name='Opnieuw beluisteren').click()
        expect(page.locator('.spacing-henk .hint-henk__mascot--speaking')).to_be_visible()
        page.get_by_role('button',name='Begrepen, Henk').click()
        expect(notice).not_to_be_visible()
        dashboard=context.new_page()
        dashboard.set_viewport_size({'width':1440,'height':1000})
        dashboard.goto(origin+'/escape-the-city/dashboard.html',wait_until='load')
        panel=dashboard.get_by_role('region',name='Teamspreiding')
        expect(panel).to_be_visible(timeout=15000)
        panel.get_by_label('Speurneuzen',exact=True).check()
        panel.get_by_label('Drakenjagers',exact=True).check()
        panel.get_by_role('button',name='Eerder').nth(1).click()
        panel.get_by_role('button',name='Starttijden plannen').click()
        expect(panel.get_by_role('status')).to_contain_text('Teamspreiding opgeslagen.')
        dashboard.screenshot(path=str(diagnostics/'spacing-dashboard-1440.png'),full_page=True)
        assert not errors,errors
        print('Spacing: countdown, real departure, mobile Henk message, voice replay and shared dismissal passed.')
    finally: context.close()
