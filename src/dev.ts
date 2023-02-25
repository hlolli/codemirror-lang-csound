import { EditorView, basicSetup } from 'codemirror';
// import { EditorState, Compartment } from '@codemirror/state';
import { csoundMode } from './index';

const editor = new EditorView({
  extensions: [basicSetup, csoundMode()],
  parent: document.getElementById('editor')!,
});

const csdExample = `<CsoundSynthesizer>
<CsOptions>
</CsOptions>
<CsInstruments>

sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1.0

instr 1
  if changed(kdeltim1) then
    event "i", ideltap_instr,0,1
    k1 = 0
  endif

  if changed(kdeltim1) then
    event "i", 1,0,1
    k1 = 0
  else
    k1 = 0
  endif

endin

opcode pr_str, S, i
  iast xin
  if (iast > 0) then
    Sout = ""
    itype = tab_i(0, iast)
    if (itype == giNumberType) then
      Sout = sprintf("%d", tab_i(2, iast))
    elseif (itype == giStringType) then
      ilen = tab_i(1, iast)
      idx = 0
      SfromAscii = ""
      while idx < ilen do
        SfromAscii = strcat(SfromAscii, sprintf("%c", tab_i(2 + idx, iast)))
        idx += 1
      od
      Sout = sprintf("\"%s\"", SfromAscii)
    elseif (itype == giKeywordType) then
      ilen = tab_i(1, iast)
      idx = 0
      SfromAscii = ""
      while idx < ilen do
        SfromAscii = strcat(SfromAscii, sprintf("%c", tab_i(2 + idx, iast)))
        idx += 1
      od
      Sout = sprintf(":%s", SfromAscii)
    elseif (itype == giListType) then
      ilen = tab_i(1, iast)
      print ilen
      idx = 0
      while idx < ilen do
        Snext = pr_str(tab_i(2 + idx, iast))
        ;; join " "
        if idx > 0 then
          Sout = strcat(" ", Snext)
        else
          Sout = Snext
        endif
      od
    elseif (itype == giNilType) then
      Sout = "nil"
    elseif (itype == giTrueType) then
      Sout = "true"
    elseif (itype == giFalseType) then
      Sout = "false"
    else
      ilen = tab_i(1, iast)
      idx = 0
      SfromAscii = ""
      while idx < ilen do
        SfromAscii = strcat(SfromAscii, sprintf("%c", tab_i(2 + idx, iast)))
        idx += 1
      od
      Sout = SfromAscii
    endif
  endif
  xout Sout
endop

instr 1
  iparam = 1
  cigoto iparam == 1, highnote
  igoto lownote

  if(kunison_voices <= 1) then
    asig += vco2(kamp1, kfreq * kdetune1, ivco1_type, kpwm1, rnd(1) )
  else
    sdf
    highnote:
      qifreq = 880
      goto playit

    lownote:
      ifreq = 440
      goto playit

    playit:
      ; Print the values of iparam and ifreq.
      print iparam
      print ifreq

      a1 oscil 10000, ifreq, 1
      out a1
    endif
endin


instr MSynth

  ifreq = p4
  iamp = p5
  ioff = p6 * 36
  iout_bus = p7

  ;print tab_i(ioff + 15, gi_ms_pre)


  /* SOURCE SIGNALS */
  kamp1 = tab_i(ioff + 0, gi_ms_pre)
  kamp2 = tab_i(ioff + 7, gi_ms_pre)
  kamp3 = tab_i(ioff + 11, gi_ms_pre)

  ;;print ifreq, iamp
  ;; printk2 kamp1

  kdetune1 = semitone(tab_i(ioff + 2, gi_ms_pre) * 12 + tab_i(ioff + 3, gi_ms_pre))
  kdetune2 = semitone(tab_i(ioff + 9, gi_ms_pre) * 12 + tab_i(ioff + 10, gi_ms_pre))
  kdetune3 = semitone(tab_i(ioff + 13, gi_ms_pre) * 12 + tab_i(ioff + 14, gi_ms_pre))

  ;; apply lfo
  kfreq = ifreq * semitone(lfo:k(tab_i(ioff + 32, gi_ms_pre), tab_i(ioff + 31, gi_ms_pre)))

  asig = 0

  if(kamp1 > 0) then
    kamp1 = ampdbfs(-60 + kamp1 * 6)
    kpwm1 = limit:k(lfo(tab_i(ioff + 34, gi_ms_pre), tab_i(ioff + 33, gi_ms_pre)) + tab_i(ioff + 1, gi_ms_pre), 0.001, 0.999)

    kunison_voices = tab_i(ioff + 4, gi_ms_pre)

    ivco1_type = gi_vco_types[tab_i(ioff + 15, gi_ms_pre)]

    if(kunison_voices <= 1) then
      asig += vco2(kamp1, kfreq * kdetune1, ivco1_type, kpwm1, rnd(1) )
    else

      if(changed(kunison_voices) == 1) then
        kunison_detune = tab_i(ioff + 5, gi_ms_pre) * 2
        ksemi_base = -kunison_detune * .5
        ksemi_div = kunison_voices - 1
        kuni_freq_unit = kunison_detune / ksemi_div

        kndx = 0
        while (kndx < kunison_voices) do
          gk_unison_freqs[kndx] = semitone(ksemi_base + kndx * (kunison_detune / ksemi_div))
          kndx += 1
        od

      endif

      kuni_gain = tab_i(ioff + 6, gi_ms_pre)
      kunison_gain init 0

      if(changed(kuni_gain) == 1) then
        kunison_gain = kuni_gain > 0 ? ampdbfs(-60 + kuni_gain * 6) : 0
      endif

      kmid_voice_indx = floor(kunison_voices / 2)

      kdfreq = kdetune1 * kfreq

      kamp_uni = kamp1 * kunison_gain

      asig += vco2(kamp_uni, kdfreq * gk_unison_freqs[0], ivco1_type, kpwm1, rnd(1))
      asig += vco2(kmid_voice_indx == 1 ? kamp1 : kamp_uni, kdfreq * gk_unison_freqs[1], ivco1_type, kpwm1,rnd(1) )
      asig += vco2(kmid_voice_indx == 2 ? kamp1 : kamp_uni, kdfreq * gk_unison_freqs[2], ivco1_type, kpwm1,rnd(1) )

      if(kunison_voices > 3) then
        asig += vco2(kmid_voice_indx == 3 ? kamp1 : kamp_uni, kdfreq * gk_unison_freqs[3], ivco1_type, kpwm1,rnd(1) )
        asig += vco2(kmid_voice_indx == 4 ? kamp1 : kamp_uni, kdfreq * gk_unison_freqs[4], ivco1_type, kpwm1,rnd(1) )
      endif
      if(kunison_voices > 5) then
        asig += vco2(kamp_uni, kdfreq * gk_unison_freqs[5], ivco1_type, kpwm1,rnd(1) )
        asig += vco2(kamp_uni, kdfreq * gk_unison_freqs[6], ivco1_type, kpwm1,rnd(1) )
      endif
      if(kunison_voices > 7) then
        asig += vco2(kamp_uni, kfreq * kdfreq * gk_unison_freqs[7], ivco1_type, kpwm1,rnd(1) )
        asig += vco2(kamp_uni, kfreq * kdfreq * gk_unison_freqs[8], ivco1_type, kpwm1,rnd(1) )
      endif
      if(kunison_voices > 9) then
        asig += vco2(kamp_uni, kfreq * kdfreq * gk_unison_freqs[9], ivco1_type, kpwm1,rnd(1) )
        asig += vco2(kamp_uni, kfreq * kdfreq * gk_unison_freqs[10], ivco1_type, kpwm1,rnd(1) )
      endif


    endif

  endif

  if(kamp2 > 0) then
    kamp2 = ampdbfs(-60 + kamp2 * 6)
    asig += vco2(kamp2, kfreq * kdetune2, gi_vco_types[tab_i(ioff + 16, gi_ms_pre)], tab_i(ioff + 8, gi_ms_pre))
  endif

  if(kamp3 > 0) then
    kamp3 = ampdbfs(-60 + kamp3 * 6)
    asig += vco2(kamp3, kfreq * kdetune3, gi_vco_types[tab_i(ioff + 17, gi_ms_pre)], tab_i(ioff + 12, gi_ms_pre))
  endif

  ;    kamp_sum = (kamp1 + kamp2 + kamp3)
  ;    if(kamp_sum > 0) then
  ;        asig *= (1 / kamp_sum) * 0.5
  ;    endif
  asig *= 0.4

  /* FILTER */

  ;; keyfollow + env w/depth
  ikey_oct = octcps(ifreq) * tab_i(ioff + 35, gi_ms_pre)
  icut_oct = tab_i(ioff + 29, gi_ms_pre)
  acut_env = transegr:a(0, tab_i(ioff + 22, gi_ms_pre), 0, 1, tab_i(ioff + 23, gi_ms_pre), tab_i(ioff + 24, gi_ms_pre), tab_i(ioff + 25, gi_ms_pre), tab_i(ioff + 26, gi_ms_pre), -4.2, 0)
  acut_env *= tab_i(ioff + 27, gi_ms_pre)
  ;;acut_lfo = lfo(chnget:k("lfo_cut_depth"), chnget:k("lfo_cut_freq"))



  ;acut = limit(cpsoct(-2 + ikey_oct + icut_oct + acut_env + acut_lfo), 20, 20000)
  acut = limit(cpsoct(-2 + ikey_oct + icut_oct + acut_env), 20, 20000)


  kfilt_type = tab_i(ioff + 30, gi_ms_pre)


  if(kfilt_type == 1) then
    kres = tab_i(ioff + 28, gi_ms_pre) * 2.45 + .5
    asig = zdf_2pole(asig, acut, kres)
    ;    elseif (kfilt_type == 2) then
    ;        asig = spf(asig, acut, 2)
  elseif(kfilt_type == 2) then
    kres = tab_i(ioff + 28, gi_ms_pre) * 2.45 + .5
    asig = zdf_ladder(asig, acut, kres)
  else
    kres = tab_i(ioff + 28, gi_ms_pre) * 1.7
    asig = diode_ladder(asig, acut, kres)
  endif


  ;; asig = K35_hpf(asig, ifreq * .5, 3)

  /* AMP AND POST */
  ;asig = dcblock2(asig)

  asig *= transegr:a(0, tab_i(ioff + 18, gi_ms_pre), 0, 1, tab_i(ioff + 19, gi_ms_pre), -4.2, tab_i(ioff + 20, gi_ms_pre), tab_i(ioff + 21, gi_ms_pre), -4.2, 0) * iamp * 0.5

  ; a1, a2  pan2 asig, 0

  ;a1 = asig
  ;a2 = asig

  ;; out(asig, asig)

  ;out(a1, a2)
  asig *= 10
  if(iout_bus == gi_BUS_ARP1) then
    sbus_mix(iout_bus, asig, a(0))
  elseif (iout_bus == gi_BUS_ARP2) then
    sbus_mix(iout_bus, a(0), asig)
  else
    sbus_mix(iout_bus, asig, asig)
  endif

endin

</CsInstruments>
<CsScore>

i 1 0   .1 60
i . ^+1 .  >
i . ^+1 .  >
i . ^+1 .  >
i . ^+1 .  64

</CsScore>
</CsoundSynthesizer>
`;

editor.dispatch({
  changes: { from: 0, to: editor.state.doc.length, insert: csdExample },
});
