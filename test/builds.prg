// hbmk2 builds -gtcgi

#define CRLF chr(13)+chr(10)
/*
		"#include <hbclass.ch>" + CRLF + + CRLF + ;
		"class oggetto" + CRLF + ;
		"   METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )" + CRLF + ;
		"endclass" + CRLF + ;
*/
proc main()
	LOCAL cTest := ;
		"proc test()" + CRLF + ;
		" LOCAL bTest := {|| pippo() }" + CRLF + ;
		" LOCAL i:= 1" + CRLF + ;
		" i += 2" + CRLF + ;
		" j := 2" + CRLF + ;
		" test2('aa')" + CRLF + ;
		"return" + CRLF + CRLF + ;
		"proc test2(pippo)" + CRLF + ;
		" FIELD a" + CRLF + ;
		" LOCAL i:= 1, j := 4, k:= 5" + CRLF + ;
		" i += 2" + CRLF + ;
		" ? i" + CRLF + ;
		"return" 
	LOCAL aMsg, i
	? test2(cTest, @aMsg)
	? valtype(aMsg), len(aMsg)
	for i:=1 to len(aMsg)
	    ? aMsg[i,1], aMsg[i,2], aMsg[i,3], aMsg[i,4], aMsg[i,5] 
	next
return

proc pippo_Pluto()
	? "arrivano pippo e pluto"
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
	printf("open\r\n");
	printf("%s(%i,%i,%i):", zFileName,  fBefore, fSysFile, fBinary);
	//printf(szText,szPar1,szPar2);
	printf("\r\n");
	while(pInc)
	{
		printf("  %s(%i)\r\n",pInc->szPath,pInc->fFree);
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
    printf("msg %X (%i)\r\n", szMess, len);
    sprintf(szMess, szText,szPar1,szPar2);
    hb_arraySetC(pMsgItem, 5, szMess);
    hb_xfree(szMess);
    hb_arrayAdd(pMsgDest, pMsgItem);
 //  printf("msg\r\n");

    printf("%c #%i (%s:%i):", cPrefix,  iValue, szModule, iLine);
    printf(szText,szPar1,szPar2);
    printf("\r\n"); //*/
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

HB_FUNC( TEST2 )
{
	const char * szSource = hb_parc( 1 );
	const char * szFileName = "perry.prg";
	PHB_ITEM pMsgDest = hb_param(2,HB_IT_BYREF );
	HB_COMP_DECL;
	int iStatus = 0;
	PHB_HFUNC pFunc;
	PHB_HVAR pVar;
	PHB_DEBUGINFO pDebug;
	
	printf("dest: %X\r\n",pMsgDest);
	
	HB_COMP_PARAM = hb_comp_new();
	if( pMsgDest )
	{
		HB_COMP_PARAM->cargo = pMsgDest;
		HB_COMP_PARAM->outMsgFunc = pMsgFunc;
		hb_arrayNew(pMsgDest,0);
	}
	HB_COMP_PARAM->iWarnings = 3;
	HB_COMP_PARAM->fDebugInfo = HB_TRUE;
	HB_COMP_PARAM->fLineNumbers = HB_TRUE;

	hb_compChkEnvironment( HB_COMP_PARAM );
	HB_COMP_PARAM->iSyntaxCheckOnly = 1;
	hb_compInitPP( HB_COMP_PARAM, pOpenFunc );
	hb_compIdentifierOpen( HB_COMP_PARAM );

	//iStatus = hb_compCompile( HB_COMP_PARAM, "{SOURCE}", szSource, iStartLine );
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

	printf(" ****  \r\n");
	pDebug = hb_compGetDebugInfo( HB_COMP_PARAM );
	while(pDebug)
	{
		printf("%s(%lu-%lu):%lu\r\n",pDebug->pszModuleName,pDebug->ulFirstLine,pDebug->ulLastLine,pDebug->ulAllocated);
		pDebug = pDebug->pNext;
	}
	pFunc = HB_COMP_PARAM->functions.pFirst;
	while( pFunc)
	{
	/* skip pseudo function frames used in automatically included
		files for file wide declarations */
	//	if( ( pFunc->funFlags & HB_FUNF_FILE_DECL ) == 0 )
		{
			//hb_compOptimizeFrames( HB_COMP_PARAM, pFunc );
			printf("%s (%i)\r\n",pFunc->szName,pFunc->iDeclLine);
			pVar = pFunc->pLocals;
			while(pVar)
			{
				printf("L-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
				pVar = pVar->pNext;
			}
			pVar = pFunc->pStatics;
			while(pVar)
			{
				printf("S-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
				pVar = pVar->pNext;
			}
			pVar = pFunc->pFields;
			while(pVar)
			{
				printf("F-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
				pVar = pVar->pNext;
			}
			pVar = pFunc->pMemvars;
			while(pVar)
			{
				printf("M-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
				pVar = pVar->pNext;
			}
			/*
			printf("cScope         %i\r\n",pFunc->cScope);
			printf("funFlags       %i\r\n",pFunc->funFlags);
			printf("wParamCount    %i\r\n",pFunc->wParamCount);
			printf("wParamNum      %i\r\n",pFunc->wParamNum);
			printf("pLocals        %X\r\n",pFunc->pLocals);
			printf("pStatics       %X\r\n",pFunc->pStatics);
			printf("pFields        %X\r\n",pFunc->pFields);
			printf("pMemvars       %X\r\n",pFunc->pMemvars);
			printf("pDetached      %X\r\n",pFunc->pDetached);
			printf("pPrivates      %X\r\n",pFunc->pPrivates);
			printf("pCode          %X\r\n",pFunc->pCode);
			printf("nPCodeSize     %i\r\n",pFunc->nPCodeSize);
			printf("nPCodePos      %i\r\n",pFunc->nPCodePos);
			printf("pNOOPs         %X\r\n",pFunc->pNOOPs);
			printf("pJumps         %X\r\n",pFunc->pJumps);
			printf("nNOOPs         %i\r\n",pFunc->nNOOPs);
			printf("nJumps         %i\r\n",pFunc->nJumps);
			printf("iStaticsBase   %i\r\n",pFunc->iStaticsBase);
			printf("iFuncSuffix    %i\r\n",pFunc->iFuncSuffix);
			printf("iEarlyEvalPass %i\r\n",pFunc->iEarlyEvalPass);
			printf("fVParams       %i\r\n",pFunc->fVParams);
			printf("bError         %i\r\n",pFunc->bError);
			printf("bBlock         %X\r\n",pFunc->bBlock);
			printf("pEnum          %X\r\n",pFunc->pEnum);
			printf("wSeqCounter    %i\r\n",pFunc->wSeqCounter);
			printf("wAlwaysCounter %i\r\n",pFunc->wAlwaysCounter);
			printf("wForCounter    %i\r\n",pFunc->wForCounter);
			printf("wIfCounter     %i\r\n",pFunc->wIfCounter);
			printf("wWhileCounter  %i\r\n",pFunc->wWhileCounter);
			printf("wCaseCounter   %i\r\n",pFunc->wCaseCounter);
			printf("wSwitchCounter %i\r\n",pFunc->wSwitchCounter);
			printf("wWithObjectCnt %i\r\n",pFunc->wWithObjectCnt);
			*/
			pFunc = pFunc->pNext;
		}
	}
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
   printf("call\r\n");
   iResult = hb_compMainExt( argc, argv, &pBuffer, &nLen, szSource, 0, 0, 0, pMsgFunc );
   //hb_compCompile( pComp, "{SOURCE}", szSource, iStartLine );
   printf("%i\r\n",iResult);
   if( iResult == EXIT_SUCCESS && pBuffer )
      hb_retclen_buffer( ( char * ) pBuffer, nLen );
}

HB_FUNC( callPP )
{
	PHB_DYNS pFunc = hb_dynsymFind( "PIPPO_PLUTO" );
	
}
#pragma ENDDUMP

