//#xtranslate ( <!name!>{ [<p,...>] } => (<name>():New(<p>))
//

static prova2

//#xcommand [<nTest>] CMD [<nPart2>] => <nTest> := <nPart2>
#xcommand @ <nRow>, <nCol> COMBOBOX [ <oCbx> VAR ] <cVar> ;
[ <it: PROMPTS, ITEMS> <aItems> ] ;
[ SIZE <nWidth>, <nHeight> ] ;
[ <dlg:OF,WINDOW,DIALOG> <oWnd> ] ;
[ <help:HELPID, HELP ID> <nHelpId> ] ;
[ ON CHANGE <uChange> ] ;
[ VALID <uValid> ] ;
[ <color: COLOR,COLORS> <nClrText> [,<nClrBack>] ] ;
[ <pixel: PIXEL> ] ;
[ FONT <oFont> ] ;
[ <update: UPDATE> ] ; //PROVA
[ MESSAGE <cMsg> ] ; && PROVA2
[ WHEN <uWhen> ] ; /*CIAO*/
[ <design: DESIGN> ] ;
[ BITMAPS <acBitmaps> ] ;
[ ON DRAWITEM <uBmpSelect> ] ;
[ STYLE <nStyle> ] ;
[ <pict: PICT, PICTURE> <cPicture> ];
[ ON EDIT CHANGE <uEChange> ] ;
[ HEIGHTGET <nHGet> ] ;
[ SELHEIGHT <nSelHt> ] ;
[ ITEMHEIGHT <nItmHt> ] ;
[ <lw: LISTWIDTH, DROPWIDTH> <nDropW> ] ;
[ DIRECTORY <cDir> [ATTRIB <attr>] [SAYDIR <oSayDir> ] ] ;
=> ;
[ <oCbx> := ] TComboBox():New( <nRow>, <nCol>, bSETGET(<cVar>),;
   <aItems>, <nWidth>, <nHeight>, <oWnd>, <nHelpId>,;
   [{|Self|<uChange>}], <{uValid}>, <nClrText>, <nClrBack>,;
   <.pixel.>, <oFont>, <cMsg>, <.update.>, <{uWhen}>,;
   <.design.>, <acBitmaps>, [{|nItem|<uBmpSelect>}], <nStyle>,;
   <cPicture>, [<{uEChange}>], [<(oCbx)>], <nHGet>, [<nSelHt>], [<nItmHt>], [<nDropW>], [<cDir>], ;
   [<attr>], [<oSayDir>] )

func testFunc
   LOCAL puppo, ; /* ciao */
      prova

proc main()
   // se tutti quelli [] dall'altro lato può essere ripetuto
   local o1,o2, tmp, ;
         o3, v, r:=5
   v CMD r
   //@ 10,10 COMBOBOX o1 VAR   tmp WINDOW o2