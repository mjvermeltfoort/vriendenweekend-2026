import type { ReactElement } from 'react';
import './BoschMonsterPuzzle.css';

export type MonsterSelection = { head?: string; body?: string; object?: string };

const ink = '#292b24';
const teal = '#4e7772';
const rust = '#9b4d32';
const gold = '#c39958';

/** Original vector artwork. Every combination is actually redrawn, not a label swap. */
export function BoschMonsterArt({ selection, animated = false }: {
  selection: MonsterSelection;
  animated?: boolean;
}): ReactElement {
  const head = selection.head ?? 'Kikker';
  const body = selection.body ?? 'Ton';
  const legs = selection.object ?? 'Wielen';
  return (
    <svg
      className={`bosch-art${animated ? ' bosch-art--alive' : ''}`}
      viewBox="0 0 280 410"
      role="img"
      aria-label={`Monster met ${head.toLowerCase()} als hoofd, ${body.toLowerCase()} als lijf en ${legs.toLowerCase()} als onderkant`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bosch-paint" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e9c88d" /><stop offset=".55" stopColor="#aa713e" /><stop offset="1" stopColor="#4c3731" />
        </linearGradient>
        <radialGradient id="bosch-scale">
          <stop stopColor="#a0b9a0" /><stop offset=".85" stopColor="#4c7471" /><stop offset="1" stopColor="#315357" />
        </radialGradient>
        <pattern id="bosch-hatch" width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M0 11 L11 0 M-3 3 L3 -3" stroke="#312e26" opacity=".16" strokeWidth="1.4" />
        </pattern>
      </defs>
      <g stroke={ink} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="140" cy="392" rx="104" ry="12" fill="#41332b" opacity=".15" stroke="none" />
        {legs === 'Mens' ? (
          <g className="bosch-art__legs">
            <path d="M100 275 Q92 315 90 353 L81 381 Q65 396 39 392 Q31 386 46 377 L69 369 L71 296 Z" fill="#deb58d" />
            <path d="M173 275 Q182 313 184 353 L207 377 Q226 385 239 379 Q244 370 217 363 L199 344 L201 284 Z" fill="#d8a879" />
            <path d="M74 305 L106 306 M173 308 L201 304 M94 346 L84 349 M183 346 L195 350" fill="none" opacity=".48" />
            <path d="M45 384 L45 390 M56 381 L57 390 M68 379 L70 389 M214 371 L217 381 M225 372 L229 379" fill="none" strokeWidth="1.7" />
            <path d="M73 291 L108 296 M171 290 L202 285" fill="none" stroke="#8d4736" strokeWidth="6" />
          </g>
        ) : legs === 'Vogelpoten' ? (
          <g className="bosch-art__legs">
            <path d="M103 279 Q108 323 90 349 L77 376 M170 279 Q172 329 190 352 L208 378" fill="none" stroke="#ac713d" strokeWidth="17" />
            <path d="M92 347 L78 377 L50 384 M78 377 L82 394 M78 377 L111 387 M189 351 L207 377 L234 385 M207 377 L210 395 M207 377 L178 391" stroke="#754b2c" strokeWidth="8" fill="none" />
            <path d="M49 384 L39 397 L56 391 M112 387 L120 399 L106 393 M236 385 L246 397 L231 391" fill="#c99b67" />
            <path d="M85 327 L105 329 M175 326 L194 323" stroke="#dcbe81" fill="none" strokeWidth="3" />
          </g>
        ) : (
          <g className="bosch-art__legs">
            <path d="M123 282 L124 359 L87 366 M161 282 L161 359 L198 366" stroke="#75512e" strokeWidth="17" fill="none" />
            <path d="M78 351 L204 351" stroke="#b88b4f" strokeWidth="14" fill="none" />
            {[72,210].map(x=><g key={x}>
              <circle cx={x} cy="363" r="30" fill="#6a4f3c" stroke="#d6ab6e" strokeWidth="6"/>
              <circle cx={x} cy="363" r="20" fill="#2b342f" stroke="#a17b4b" strokeWidth="3"/>
              {[0,45,90,135].map(deg=><path key={deg} d={`M${x-19} 363 L${x+19} 363`} transform={`rotate(${deg} ${x} 363)`} stroke="#b79462" strokeWidth="3" />)}
              <circle cx={x} cy="363" r="6" fill={gold}/>
            </g>)}
          </g>
        )}
        {body === 'Vis' ? (
          <g className="bosch-art__body">
            <path d="M86 203 Q30 154 38 204 Q22 236 44 256 Q33 303 91 276 L120 297 Q180 311 200 270 Q233 245 210 203 Q196 152 132 156 Q97 165 86 203 Z" fill="url(#bosch-scale)" />
            <path d="M76 180 L60 147 L110 177 M191 193 Q219 159 232 169 L211 227" fill={rust}/>
            <path d="M89 282 L72 307 L120 294 M161 290 L196 313 L187 276" fill="#c39a58"/>
            {Array.from({length:6},(_,row)=>Array.from({length:5},(_,col)=>{
              const x=91+col*22+(row%2?11:0),y=181+row*19;
              return <path key={`${row}-${col}`} d={`M${x-9} ${y} Q${x} ${y+20} ${x+10} ${y}`} fill="none" stroke="#d1be87" strokeWidth="2.4" opacity=".85"/>;
            }))}
            <path d="M94 188 Q127 165 179 180" fill="none" stroke="#c1d2ad" strokeWidth="5"/>
            <path d="M127 284 L167 290" fill="none" stroke="#203b3b" opacity=".6"/>
          </g>
        ) : body === 'Ton' ? (
          <g className="bosch-art__body">
            <path d="M84 157 Q62 235 88 301 Q138 318 195 299 Q222 229 197 157 Q139 143 84 157 Z" fill="url(#bosch-paint)" />
            <ellipse cx="141" cy="156" rx="58" ry="16" fill="#553a2f" strokeWidth="4" />
            <ellipse cx="141" cy="157" rx="44" ry="9" fill="#1d2422"/>
            <path d="M94 173 L105 291 M125 169 L124 299 M161 170 L161 300 M188 168 L180 296" fill="none" stroke="#573722" strokeWidth="3" />
            <path d="M82 195 Q136 207 205 194 M83 273 Q143 290 202 270" fill="none" stroke="#44423a" strokeWidth="15"/>
            <path d="M82 195 Q136 207 205 194 M83 273 Q143 290 202 270" fill="none" stroke="#d5b87b" strokeWidth="4" strokeDasharray="4 12"/>
            <path d="M84 157 Q62 235 88 301 Q138 318 195 299 Q222 229 197 157 Q139 143 84 157 Z" fill="url(#bosch-hatch)" stroke="none"/>
          </g>
        ) : (
          <g className="bosch-art__body">
            <path d="M76 165 Q115 149 140 171 Q180 147 205 164 L211 291 Q174 281 142 298 Q110 278 73 287 Z" fill="#b5794a"/>
            <path d="M140 171 Q137 243 142 298 L155 303 Q148 230 153 172" fill="#bd975c"/>
            <path d="M81 178 Q115 167 137 187 L135 286 Q108 268 80 277 Z" fill={rust}/>
            <path d="M157 186 Q183 162 201 173 L202 277 Q181 269 154 286 Z" fill={teal}/>
            <path d="M92 188 L125 199 M169 200 L193 188 M89 256 L126 265 M164 264 L197 253" fill="none" stroke="#d6b874" strokeWidth="3"/>
            <circle cx="109" cy="228" r="16" fill="none" stroke="#d6b874" strokeWidth="5"/><circle cx="180" cy="229" r="16" fill="none" stroke="#d6b874" strokeWidth="5"/>
            <path d="M141 178 L145 292" stroke="#d8b582" strokeWidth="6"/>
          </g>
        )}
        {head === 'Vogel' ? (
          <g className="bosch-art__head">
            <path d="M115 155 Q102 132 101 107 Q79 87 99 51 Q135 17 176 52 Q189 80 163 111 L164 154 Z" fill="#bb8251"/>
            <path d="M89 80 Q68 97 54 127 Q108 119 130 92 L121 76 Z" fill="#f2d39c" />
            <path d="M92 79 Q68 104 54 127" fill="none" stroke="#754f36" strokeWidth="4"/>
            <path d="M106 71 Q95 27 133 22 Q159 12 181 66 L151 49 L129 50 Z" fill={teal}/>
            <path d="M128 21 L134 7 L145 27 M154 26 L166 9 L169 38" stroke={rust} fill={gold} strokeWidth="3" />
            <circle cx="141" cy="74" r="16" fill="#f8dda7"/><circle cx="146" cy="73" r="8" fill="#251f1d"/><circle cx="149" cy="69" r="3" fill="#fff1db" stroke="none" />
            <path d="M112 129 Q137 150 154 134 M112 139 L103 158 M130 143 L125 157" fill="none" stroke="#e6ac6d" strokeWidth="5"/>
            <path d="M100 54 L85 42 L98 70 M176 63 L191 52 L178 85" fill={rust}/>
          </g>
        ) : head === 'Kikker' ? (
          <g className="bosch-art__head">
            <path d="M100 157 Q72 133 68 95 Q58 49 94 52 Q119 24 148 43 Q186 26 199 70 Q219 122 175 158 Z" fill="#7b9061" />
            <ellipse cx="96" cy="69" rx="25" ry="29" fill="#87995f"/><ellipse cx="181" cy="69" rx="25" ry="29" fill="#87995f"/>
            <circle cx="96" cy="65" r="17" fill="#e7bc64"/><circle cx="181" cy="65" r="17" fill="#e7bc64"/>
            <circle cx="101" cy="65" r="7" fill="#222625"/><circle cx="176" cy="65" r="7" fill="#222625"/>
            <path d="M79 113 Q135 154 195 114 Q172 149 138 153 Q102 151 79 113" fill="#f2cf97"/>
            <path d="M112 111 Q140 117 160 110" fill="none" stroke="#333d31" strokeWidth="3"/>
            <circle cx="117" cy="89" r="4" fill="#454d38"/><circle cx="156" cy="89" r="4" fill="#454d38"/>
            <path d="M118 44 L126 22 L135 37 L148 15 L157 39 L170 28 L175 51 Z" fill={gold}/>
          </g>
        ) : (
          <g className="bosch-art__head">
            <path d="M100 153 Q73 130 83 91 Q72 65 90 52 Q116 23 154 39 Q197 42 201 86 Q216 131 174 156 Z" fill={rust}/>
            <path d="M103 53 Q76 11 97 5 Q112 8 128 45 M160 47 Q173 4 191 8 Q205 17 184 63" fill="url(#bosch-paint)" />
            <path d="M89 96 L53 84 L80 123 M194 93 L222 76 L203 129" fill="#b45f39"/>
            <ellipse cx="121" cy="87" rx="20" ry="15" fill="#e7c98e"/><ellipse cx="172" cy="86" rx="19" ry="15" fill="#e7c98e"/>
            <circle cx="126" cy="87" r="10" fill="#1a2925"/><circle cx="169" cy="85" r="9" fill="#1a2925"/>
            <path d="M123 113 Q154 137 184 107 L175 143 L141 147 Z" fill="#412b27"/>
            {[126,142,159,174].map(x=><path key={x} d={`M${x} 119 L${x+5} 131 L${x+10} 119`} fill="#f4d6a6" strokeWidth="1.4"/>)}
            <path d="M136 104 L155 101" fill="none" stroke="#e7c990" strokeWidth="3"/>
          </g>
        )}
        <path d="M110 159 Q139 171 171 158" fill="none" stroke="#bd8d54" strokeWidth="9" strokeDasharray="6 5" />
      </g>
      {animated ? (
        <g className="bosch-art__magic" fill="#eed189">
          {[[32,96],[239,117],[224,258],[49,243],[162,18],[125,333]].map(([x,y],i)=><path key={i} d={`M${x} ${y-9} L${x+3} ${y-2} L${x+10} ${y} L${x+3} ${y+3} L${x} ${y+10} L${x-3} ${y+3} L${x-10} ${y} L${x-3} ${y-2} Z`} />)}
        </g>
      ) : null}
    </svg>
  );
}
