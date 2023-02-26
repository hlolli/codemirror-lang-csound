import { EditorView, basicSetup } from 'codemirror';
import { Tree } from '@lezer/common';
// import { EditorState, Compartment } from '@codemirror/state';
import { csoundMode } from './index';
import { parser } from './syntax.grammar';
import { printTree } from './print-tree';

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

const csdExample2 = `
<CsoundSynthesizer>
<CsOptions>
</CsOptions>
<CsInstruments>

sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1.0

instr 1
 kArr1[] fillarray 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
 ix = lenarray(kArr1)
  kpwm1 = limit:k(lfo(tab_i(ioff + 34, gi_ms_pre), tab_i(ioff + 33, gi_ms_pre)) + tab_i(ioff + 1, gi_ms_pre), 0.001, 0.999)
endin

</CsInstruments>
<CsScore>


i1 805.0 9.69651898734177 395.081430905728 618.0 1617.877032 0.1 0.849505677872391 236.06491250319 0.0 1.34950567787239 3.23217299578059 1.93930379746835 0.02 0.415243646538506 0.1 0.0 0.0 0.0 0.0 0.0 0.767484305656071 0.0 0.0 0.641067734776613 0.0 0.0 2 6 5 4
i1 812.75721518987342 4.94899162983368 280.977745218576 1173.88755409051 3073.14840115485 0.1 0.582651964827666 448.403985024206 0.0 1.08265196482767 1.64966387661123 0.989798325966736 0.02 0.238494846850876 0.1 0.0 0.0 0.0 0.0 0.0 0.843100534146369 0.0 0.0 0.537755975626592 0.0 0.0 2 6 5 4
i1 814.5473417721519 8.74736815441072 309.237947911611 999.924 2617.725037776 0.1 0.648092494733902 381.953028430161 0.0 1.1480924947339 2.91578938480357 1.74947363088214 0.02 0.172427285990596 0.1 0.0 0.0 0.0 0.0 0.0 0.953140140100478 0.0 0.0 0.302529128067433 0.0 0.0 2 6 5 4
i1 817.5308860759494 12.5834411626817 151.658478997159 2617.725037776 6853.0052017947 0.1 0.290142197361565 999.924 0.0 0.790142197361565 4.19448038756056 2.51668823253633 0.02 0.136979319126435 0.1 0.0 0.0 0.0 0.0 0.0 0.886901749280453 0.46195810104735 0.0 0.0 0.0 0.0 2 6 5 4
i1 822.3045569620253 15.6091801990523 226.175784861801 1617.877032 4235.47911112157 0.1 0.457164599802126 618.0 0.0 0.957164599802126 5.20306006635078 3.12183603981047 0.02 0.114584795172499 0.1 0.0 0.0 0.0 0.0 0.0 0.577942399110452 0.81607755961701 0.0 0.0 0.0 0.0 2 6 5 4
i1 834.8354430379747 13.6978498133698 253.216350128539 1378.11672651982 3607.80485315766 0.1 0.518836519605723 526.415864830231 0.0 1.01883651960572 4.56594993778993 2.73956996267396 0.02 0.0990334698870002 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.82586708367664 0.563864842049442 0.0 0.0 0.0 2 6 5 4
i1 842.5926582278481 11.9403141189164 200.086373453748 1899.35006251845 4972.35411306854 0.1 0.398161580787621 725.517647769166 0.0 0.898161580787621 3.98010470630546 2.38806282378328 0.02 0.0875436327263116 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.0 0.874634887042333 0.48478223396536 0.0 0.0 2 6 5 4
i1 844.3827848101266 13.0880459425292 175.176041266161 2229.79286350906 5837.4282524091 0.1 0.342334022188705 851.740869295313 0.0 0.842334022188705 4.36268198084308 2.61760918850585 0.02 0.0786739592745751 0.1 0.0 0.0 0.0 0.0 0.0 0.707106781186548 0.0 0.0 0.707106781186548 0.0 0.0 2 6 5 4
i1 847.366329113924 12.633670886076 337.791951621765 851.740869295313 2229.79286350906 0.1 0.71466844651859 325.349731044642 0.0 1.21466844651859 4.21122362869199 2.52673417721519 0.02 0.0715993349974727 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.885188571198883 0.465232407962817 0.0 0.0 0.0 2 6 5 4
i1 852.14 13.612625 366.458025508551 725.517647769166 1899.35006251845 0.1 0.781935526393559 277.134724984058 0.0 1.28193552639356 4.53754166666667 2.722525 0.02 0.415243646538506 0.1 0.0 0.0 0.0 0.0 0.0 0.760948141093145 0.0 0.0 0.648812705306306 0.0 0.0 2 6 5 4
i1 863.0301 7.68938161675437 395.081430905728 618.0 1617.877032 0.1 0.849505677872391 236.06491250319 0.0 1.34950567787239 2.56312720558479 1.53787632335087 0.02 0.238494846850876 0.1 0.0 0.0 0.0 0.0 0.0 0.823504666134479 0.0 0.0 0.567309496531425 0.0 0.0 2 6 5 4
i1 865.5432 13.7133515811591 280.977745218576 1173.88755409051 3073.14840115485 0.1 0.582651964827666 448.403985024206 0.0 1.08265196482767 4.57111719371971 2.74267031623183 0.02 0.172427285990596 0.1 0.0 0.0 0.0 0.0 0.0 0.9123505234866 0.0 0.0 0.409409968483582 0.0 0.0 2 6 5 4
i1 869.7317 20.053469939962 309.237947911611 999.924 2617.725037776 0.1 0.648092494733902 381.953028430161 0.0 1.1480924947339 6.68448997998734 4.0106939879924 0.02 0.136979319126435 0.1 0.0 0.0 0.0 0.0 0.0 0.96835507767838 0.249576528412628 0.0 0.0 0.0 0.0 2 6 5 4
i1 876.4333 25.6562028291649 151.658478997159 2617.725037776 6853.0052017947 0.1 0.290142197361565 999.924 0.0 0.790142197361565 8.55206760972164 5.13124056583298 0.02 0.114584795172499 0.1 0.0 0.0 0.0 0.0 0.0 0.778756897678438 0.627325827874362 0.0 0.0 0.0 0.0 2 6 5 4
i1 876.4333 2.65392025862068 200.086373453748 1899.35006251845 4972.35411306854 0.1 0.398161580787621 725.517647769166 0.0 0.898161580787621 0.884640086206894 0.530784051724137 0.02 0.415243646538506 0.1 0.0 0.0 0.0 0.0 0.0 0.767484305656071 0.0 0.0 0.641067734776613 0.0 0.0 2 6 5 4
i1 878.5564362068965 1.90839884209242 191.640958927981 2003.6637942519 5245.4395349031 0.1 0.379175619550752 765.363621805636 0.0 0.879175619550752 0.636132947364141 0.381679768418485 0.02 0.238494846850876 0.1 0.0 0.0 0.0 0.0 0.0 0.843100534146369 0.0 0.0 0.537755975626592 0.0 0.0 2 6 5 4
i1 879.36525 3.35029625457599 208.662913934677 1800.46705956263 4713.48592643845 0.1 0.417500753025065 687.746114693411 0.0 0.917500753025065 1.116765418192 0.670059250915198 0.02 0.172427285990596 0.1 0.0 0.0 0.0 0.0 0.0 0.953140140100478 0.0 0.0 0.302529128067433 0.0 0.0 2 6 5 4
i1 879.6685551724138 5.0682503192848 217.362214773843 1706.73205352772 4468.09480449951 0.1 0.437174718117283 651.941024081571 0.0 0.937174718117283 1.68941677309493 1.01365006385696 0.02 0.136979319126435 0.1 0.0 0.0 0.0 0.0 0.0 0.886901749280453 0.46195810104735 0.0 0.0 0.0 0.0 2 6 5 4
i1 880.1740637931034 6.87377077295981 167.172190347767 2352.25476201598 6158.02419559593 0.1 0.324511903280457 898.519117444198 0.0 0.824511903280457 2.29125692431994 1.37475415459196 0.02 0.114584795172499 0.1 0.0 0.0 0.0 0.0 0.0 0.577942399110452 0.81607755961701 0.0 0.0 0.0 0.0 2 6 5 4
i1 881.4883862068965 8.32037983319504 159.330671729858 2481.44235995057 6496.22750873125 0.1 0.307109812090359 947.866462109126 0.0 0.807109812090359 2.77345994439835 1.66407596663901 0.02 0.0990334698870002 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.82586708367664 0.563864842049442 0.0 0.0 0.0 2 6 5 4
i1 883.6115224137931 9.02854238103847 151.658478997159 2617.725037776 6853.0052017947 0.1 0.290142197361565 999.924 0.0 0.790142197361565 3.00951412701282 1.80570847620769 0.02 0.0875436327263116 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.0 0.874634887042333 0.48478223396536 0.0 0.0 2 6 5 4
i1 884.4203362068966 10.3529347910211 183.334860228201 2113.70651446561 5533.52301317588 0.1 0.360560714127464 807.397966658166 0.0 0.860560714127464 3.4509782636737 2.07058695820422 0.02 0.0786739592745751 0.1 0.0 0.0 0.0 0.0 0.0 0.707106781186548 0.0 0.0 0.707106781186548 0.0 0.0 2 6 5 4
i1 884.7236413793103 12.0502586206897 175.176041266161 2229.79286350906 5837.4282524091 0.1 0.342334022188705 851.740869295313 0.0 0.842334022188705 4.01675287356322 2.41005172413793 0.02 0.0715993349974727 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.885188571198883 0.465232407962817 0.0 0.0 0.0 2 6 5 4
i1 894.025 25.5500711349303 151.658478997159 2617.725037776 6853.0052017947 0.1 0.290142197361565 999.924 0.0 0.790142197361565 8.51669037831011 5.11001422698606 0.02 0.0990334698870002 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.652180950197413 0.758063327301618 0.0 0.0 0.0 2 6 5 4
i1 904.9151 25.8188515226264 226.175784861801 1617.877032 4235.47911112157 0.1 0.457164599802126 618.0 0.0 0.957164599802126 8.60628384087548 5.16377030452529 0.02 0.0875436327263116 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.0 0.887331537747867 0.461132022438266 0.0 0.0 2 6 5 4
i1 911.6167 31.9184211024106 200.086373453748 1899.35006251845 4972.35411306854 0.1 0.398161580787621 725.517647769166 0.0 0.898161580787621 10.6394737008035 6.38368422048212 0.02 0.0715993349974727 0.1 0.0 0.0 0.0 0.0 0.0 0.885188571198883 0.465232407962817 0.0 0.0 0.0 0.0 2 6 5 4
i1 918.3183 30.6817 175.176041266161 2229.79286350906 5837.4282524091 0.1 0.342334022188705 851.740869295313 0.0 0.842334022188705 10.2272333333333 6.13634 0.02 0.0658116828611607 0.1 0.0 0.0 0.0 0.0 0.0 0.0 0.532808724475686 0.84623570187188 0.0 0.0 0.0 2 6 5 4


</CsScore>
</CsoundSynthesizer>
`;

((text: string) => {
  console.log(printTree(parser.parse(text) as Tree, text));
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
  });
})(csdExample2);
