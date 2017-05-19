// export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$HOME/harbour-src/lib/linux/gcc/

// OutErr per trace
// OutStd per scrivere in stdout
// hFilenoStdin

#include <fileio.ch>

#define CRLF chr(13)+chr(10)

memvar traceLevel

procedure MyTrace(l, cMsg)
	if l <= traceLevel
		OutErr(cMsg+CRLF)
	endif
return

procedure main()
	local nRead, cLine := Space( 1024 ), i := 10
	local nWait := 0, cCurrent:="", lHeaderParsed := .F.
	public traceLevel := 2
	OutErr("start"+CRLF)
	do while .t.
		cLine := Space( 1024 )
		nRead := fRead(0, @cLine, 1024 )
		if nRead = 0
			return
		endif
		while nRead > 0
			if nWait=0
				cCurrent += left(cLine, nRead)
				lHeaderParsed := at(CRLF+CRLF, cCurrent)<>0
				if lHeaderParsed
					nWait := ReadHeader(@cCurrent, nRead)
				endif
			else
				cCurrent += left(cLine,nRead)
				nWait -= nRead
			endif
			if nWait<=0 .and. lHeaderParsed
				nRead := len(cCurrent)+nWait
				process(left(cCurrent,nRead))
				lHeaderParsed := .F.
				cLine := substr(cCurrent,nRead+1)
				cCurrent := ""
				nRead := -nWait
				nWait := 0
			else
				nRead := 0
			endif
		enddo
	end
return


function ReadHeader(cReaded, nRead)
	local nReturn := 10, aSeparated
	local cLine, nLength := 0
	do while nReturn<>1
		nReturn := at(CRLF, cReaded)
		cLine := left(cReaded, nReturn)
		cReaded := substr(cReaded, nReturn+2)
		aSeparated := hb_aTokens(cLine,":")
		if aSeparated[1]="Content-Length"
			nLength := val(aSeparated[2])
		endif
	end
return nLength-len(cReaded)

procedure process(cJson)
	LOCAL aRet :=  hb_jsonDecode(cJson)
	local i
	MyTrace(2,"received: '" + cJson+"'")
	MyTrace(1,"received:" + aRet["method"])
	switch aRet["method"]
		case "initialize"
			//MyTrace(2,"received:" + cJson)
			Initialize(aRet)
			exit
		case "textDocument/didOpen"
			Parse(aRet,aRet["params"]["textDocument"]["text"])
			exit
		case "textDocument/didSave"
			//MyTrace(2,"received:" + cJson)
			//Parse(aRet,aRet["params"]["text"])
			exit
		otherwise
			//MyTrace(2,"received:" + cJson)
			exit
	endswitch
return

procedure Initialize(hObj)
	local cWorkingPath
	LOCAL hResp := { ;
		"jsonrpc" => hObj["jsonrpc"], ;
		"id" => hObj["id"], ;
		"result" => { ; 
			"capabilities" => { ;
				"textDocumentSync" => { ;
					"save"=> { ;
						"includeText" => .T. ;
					}, ;
					"change" => 0 ;
				};
			} ;	
		} ;
	}
	switch hObj["params"]["trace"]
		case "off" 
			traceLevel := 0
			exit
		case 'messages'
			traceLevel := 1
			exit
		case 'verbose'
			traceLevel := 2
			exit
	endswitch
	MyTrace(0, "traceLeve:  '" + alltrim(str(traceLevel)) + "'" )
	traceLevel := 2
	// Create workDir under workspace
	if .not. empty(hb_HGetDef(hObj["params"],"rootUri",nil)) .or. ;
		.not. empty(hb_HGetDef(hObj["params"],"rootPath",nil))
		MyTrace(0, "rootUri:  '" + hb_HGetDef(hObj["params"],"rootUri","") + "'" )
		MyTrace(0, "rootPath: '" + hb_HGetDef(hObj["params"],"rootPath","") + "'" )
		if hb_hHasKey(hObj["params"],"rootUri")
			cWorkingPath := StrTran(hObj["params"]["rootUri"],"file://","")
		else
			cWorkingPath := hObj["params"]["rootPath"]
		endif
		cWorkingPath := hb_DirSepToOS( cWorkingPath + "/.hbmk" )
		MyTrace(0, "workPath: '" + cWorkingPath + "'" )
		hb_DirBuild( cWorkingPath )
		hb_FSetAttr( cWorkingPath, FC_HIDDEN )
	endif

	Send( hResp )
return

procedure Parse(hObj,cText)
	local hDiagnostics, aMessages :={}, aCnvMessages, i
	local uri := hObj["params"]["textDocument"]["uri"]
	Compile(cText, uri, 3, @aMessages)
	// todo: group messages by different module and send diagnostics of all modules
	// remember to translate file path with uri, it can be done in c pMsgFunc 
	//if len(aMessages)>0
		aCnvMessages := {}
		for i:=1 to len(aMessages)
			if aMessages[i,3] = uri
				aadd(aCnvMessages, { ;
					"range" => { ;
						"start" => { "line" => aMessages[i,4]-1, "character" => 0 }, ;
						"end" => { "line" => aMessages[i,4]-1, "character" => 100 } ;
					}, ;
					"severity" => iif(aMessages[i,1]="W",2,1), ;
					"message" => aMessages[i,5] ;
				} )
			endif
		next
		hDiagnostics := { ;
			"jsonrpc" => "2.0", ;
			"method" => "textDocument/publishDiagnostics", ;
			"params" => { ; 
				"uri" => uri, ;
				"diagnostics" => aCnvMessages ;	
			} ;
		}
		Send (hDiagnostics)		
	//endif
	//MyTrace(2,"text:" + hObj["params"]["textDocument"]["text"])
return

procedure Send(hMsg)
	LOCAL cResp := hb_jsonEncode(hMsg)
	MyTrace(2,"Send:" + cResp)
	OutStd("Content-Length: " + alltrim(Str(len(cResp))) + CRLF + CRLF + cResp )
return

#pragma BEGINDUMP
#include <hbapi.h>
#include <hbcomp.h>
#include <hbapiitm.h>


static int pOpenFunc( void * cargo, char * zFileName,
                          HB_BOOL fBefore, HB_BOOL fSysFile, HB_BOOL fBinary,
                          HB_PATHNAMES * pIncludePaths,
                          HB_BOOL * pfNested, FILE ** file_ptr,
                          const char ** pBufPtr, HB_SIZE * pnLen, HB_BOOL * pfFree )
{	
	HB_SYMBOL_UNUSED( cargo );
	HB_SYMBOL_UNUSED( pfNested );
	HB_SYMBOL_UNUSED( file_ptr );
	HB_SYMBOL_UNUSED( pBufPtr );
	HB_SYMBOL_UNUSED( pnLen );
	HB_SYMBOL_UNUSED( pfFree );
	
	HB_PATHNAMES* pInc = pIncludePaths;
	fprintf(stderr,"open\r\n");
	fprintf(stderr,"%s(%i,%i,%i):", zFileName,  fBefore, fSysFile, fBinary);
	fprintf(stderr,"\r\n");
	while(pInc)
	{
		fprintf(stderr,"  %s(%i)\r\n",pInc->szPath,pInc->fFree);
		pInc = pInc->pNext;
	}
	return HB_PP_OPEN_FILE;
}

static void pMsgFunc( void * cargo, int iErrorFmt, int iLine,
                      const char * szModule, char cPrefix, int iValue,
                      const char * szText,
                      const char * szPar1, const char * szPar2 )
{
    HB_SYMBOL_UNUSED( iErrorFmt );
    PHB_ITEM pMsgDest = (PHB_ITEM) ((PHB_COMP)cargo)->cargo;
    PHB_ITEM pMsgItem = hb_itemArrayNew(5);
    char szPrefix[2], *szMess, len;
    szPrefix[0] = cPrefix; szPrefix[1] = 0;
    hb_arraySetCConst(pMsgItem, 1, szPrefix);
    hb_arraySetNI(pMsgItem, 2, iValue);
    hb_arraySetCConst(pMsgItem, 3, szModule);
    hb_arraySetNI(pMsgItem, 4, iLine);
    len = strlen(szText);//sprintf(0, szText,szPar1,szPar2);
    if(szPar1) len += strlen(szPar1);
    if(szPar2) len += strlen(szPar2);
    szMess = (char*)hb_xalloc(len+1);
    sprintf(szMess, szText,szPar1,szPar2);
    hb_arraySetC(pMsgItem, 5, szMess);
    hb_xfree(szMess);
    hb_arrayAdd(pMsgDest, pMsgItem);
}

static void hb_compInitVars( HB_COMP_DECL )
{
   HB_COMP_PARAM->functions.iCount = 0;
   HB_COMP_PARAM->functions.pFirst = NULL;
   HB_COMP_PARAM->functions.pLast  = NULL;
   HB_COMP_PARAM->szAnnounce       = NULL;
   HB_COMP_PARAM->fSwitchCase      = HB_FALSE;

   HB_COMP_PARAM->symbols.iCount   = 0;
   HB_COMP_PARAM->symbols.pFirst   = NULL;
   HB_COMP_PARAM->symbols.pLast    = NULL;
   HB_COMP_PARAM->pInitFunc        = NULL;
   HB_COMP_PARAM->pLineFunc        = NULL;
   HB_COMP_PARAM->pDeclFunc        = NULL;

   HB_COMP_PARAM->iStaticCnt       = 0;
   HB_COMP_PARAM->iVarScope        = HB_VSCOMP_LOCAL;

   HB_COMP_PARAM->inlines.iCount   = 0;
   HB_COMP_PARAM->inlines.pFirst   = NULL;
   HB_COMP_PARAM->inlines.pLast    = NULL;

   HB_COMP_PARAM->szFile           = NULL;

   HB_COMP_PARAM->iModulesCount    = 0;
}

HB_FUNC( COMPILE )
{
	const char * szSource = hb_parc( 1 );
	const char * szFileName = hb_parc( 2 );
	PHB_ITEM pMsgDest = hb_param(4, HB_IT_BYREF );
	HB_COMP_DECL;
	int iStatus = 0;
	//PHB_HFUNC pFunc;
	//PHB_HVAR pVar;
	//PHB_DEBUGINFO pDebug;
	
	HB_COMP_PARAM = hb_comp_new();
	if( pMsgDest )
	{
		HB_COMP_PARAM->cargo = pMsgDest;
		HB_COMP_PARAM->outMsgFunc = pMsgFunc;
		hb_arrayNew(pMsgDest,0);
	}
	HB_COMP_PARAM->iWarnings = hb_parni( 3 );;
	HB_COMP_PARAM->fDebugInfo = HB_TRUE;
	HB_COMP_PARAM->fLineNumbers = HB_TRUE;
	HB_COMP_PARAM->fGauge = HB_FALSE;

	hb_compChkEnvironment( HB_COMP_PARAM );
	HB_COMP_PARAM->iSyntaxCheckOnly = 1;
	hb_compInitPP( HB_COMP_PARAM, pOpenFunc );
	hb_compIdentifierOpen( HB_COMP_PARAM );

   	hb_compInitVars( HB_COMP_PARAM );
	if( ! hb_pp_inBuffer( HB_COMP_PARAM->pLex->pPP, szFileName, szSource, strlen( szSource ), 0 ) )
	{
		hb_compOutErr( HB_COMP_PARAM, "Cannot create preprocessor buffer." );
		iStatus = EXIT_FAILURE;
		hb_comp_free( HB_COMP_PARAM );
		return;
	}
	HB_COMP_PARAM->iModulesCount = 1;
	HB_COMP_PARAM->currLine = hb_pp_line( HB_COMP_PARAM->pLex->pPP ) + 1;
	HB_COMP_PARAM->currModule = hb_compIdentifierNew(
		HB_COMP_PARAM, szFileName, HB_IDENT_COPY );

	hb_comp_yyparse( HB_COMP_PARAM );

	hb_comp_free(HB_COMP_PARAM);
	hb_retni(iStatus);
}

HB_FUNC( TEST )
{
   const char * szSource = hb_parc( 1 );
   int argc = 0, i;
   const char ** argv= 0;
   int iResult;
   HB_BYTE * pBuffer;
   HB_SIZE nLen;
   PHB_ITEM pParam = hb_param( 2, HB_IT_ARRAY );
   if( pParam )
   {
      argc = hb_arrayLen( pParam );
      argv = ( const char ** ) hb_xgrab( sizeof( char * ) * ( argc + 1 ) );
      for( i = 1; i <= argc; ++i )
      {
         argv[ i-1 ] = hb_arrayGetCPtr( pParam, i );
      }
   }
   //printf("call\r\n");
   iResult = hb_compMainExt( argc, argv, &pBuffer, &nLen, szSource, 0, 0, 0, pMsgFunc );
   //hb_compCompile( pComp, "{SOURCE}", szSource, iStartLine );
   //printf("%i\r\n",iResult);
   if( iResult == EXIT_SUCCESS && pBuffer )
      hb_retclen_buffer( ( char * ) pBuffer, nLen );
}
#pragma ENDDUMP

